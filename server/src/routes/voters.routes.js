const express = require('express');
const Voter = require('../models/Voter');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.patch('/:i/details', authRequired, async (req, res) => {
  if (!req.user.toSafeJSON().superAdmin) return res.sendStatus(403);
  const i = Number(req.params.i);
  const fields = req.body;
  if (!Number.isSafeInteger(i) || !fields || typeof fields !== 'object' || !Object.keys(fields).length) return res.sendStatus(400);
  const update = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'a') {
      if (value !== null && (!Number.isInteger(value) || value < 0 || value > 150)) return res.sendStatus(400);
    } else if (key === 'd') {
      if (typeof value !== 'boolean') return res.sendStatus(400);
    } else if (!['n','rn','rel','g','h','m','e','l'].includes(key) || typeof value !== 'string' ||
               value.length > 250 || (key === 'n' && !value.trim())) return res.sendStatus(400);
    update['details.' + key] = typeof value === 'string' ? value.trim() : value;
  }
  try {
    const voter = await Voter.findOneAndUpdate({ i }, { $set: update }, { new: true }).select('details -_id').lean();
    if (!voter) return res.sendStatus(404);
    res.json({ details: voter.details });
  } catch { res.sendStatus(500); }
});

// GET /api/voters  -> full dataset used for client-side fuzzy search
router.get('/', authRequired, async (req, res) => {
  try {
    const filter = {};
    if (req.query.ward) filter.w = Number(req.query.ward);

    const voters = await Voter.find(filter, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
      .sort({ i: 1 })
      .lean();

    res.set('Cache-Control', 'private, no-cache');
    res.json({ count: voters.length, voters });
  } catch (e) {
    console.error('voters error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/voters/meta -> wards + mohallas for filter dropdowns
router.get('/meta', authRequired, async (_req, res) => {
  try {
    const wards = await Voter.distinct('w');
    const mohallas = await Voter.distinct('m');
    res.json({
      wards: wards.filter((w) => typeof w === 'number').sort((a, b) => a - b),
      mohallas: mohallas.filter(Boolean).sort(),
      total: await Voter.countDocuments({ d: { $ne: true } }),
    });
  } catch (e) {
    console.error('meta error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
