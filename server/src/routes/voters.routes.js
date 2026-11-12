const express = require('express');
const Voter = require('../models/Voter');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// GET /api/voters  -> full dataset used for client-side fuzzy search
router.get('/', authRequired, async (req, res) => {
  try {
    const filter = {};
    if (req.query.ward) filter.w = Number(req.query.ward);

    const voters = await Voter.find(filter, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
      .sort({ i: 1 })
      .lean();

    res.set('Cache-Control', 'private, max-age=300');
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
