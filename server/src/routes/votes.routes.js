const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Voter = require('../models/Voter');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/accounts', async (req, res, next) => {
  if (!req.user.toSafeJSON().superAdmin) return res.sendStatus(403);
  try {
    const accounts = await User.find({}, 'name username').sort({ username: 1 }).lean();
    res.json({ accounts });
  } catch (error) { next(error); }
});

router.use('/:owner', (req, res, next) => {
  const owner = req.params.owner;
  if (owner !== String(req.user._id) && !req.user.toSafeJSON().superAdmin) return res.sendStatus(403);
  if (!mongoose.isObjectIdOrHexString(owner)) return res.sendStatus(400);
  next();
});

router.get('/:owner', async (req, res, next) => {
  try {
    const account = await User.findById(req.params.owner).select('+votedIds').lean();
    if (!account) return res.sendStatus(404);
    res.json({ ids: account.votedIds || [] });
  } catch (error) { next(error); }
});

router.put('/:owner/:id', async (req, res, next) => {
  if (req.params.owner !== String(req.user._id)) return res.sendStatus(403);
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || !await Voter.exists({ i: id, d: { $ne: true } })) return res.sendStatus(404);
    await User.updateOne({ _id: req.user._id }, { $addToSet: { votedIds: id } });
    res.sendStatus(204);
  } catch (error) { next(error); }
});

router.delete('/:owner/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id)) return res.sendStatus(400);
    await User.updateOne({ _id: req.params.owner }, { $pull: { votedIds: id } });
    res.sendStatus(204);
  } catch (error) { next(error); }
});

module.exports = router;
