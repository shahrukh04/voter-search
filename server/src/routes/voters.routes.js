const express = require('express');
const Voter = require('../models/Voter');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();
const Edit = require('../models/Edit');
const search = import('../../../client/src/lib/search.js');

router.post('/search', authRequired, async (req, res, next) => {
  try {
    const { prepare, run, defaultState, suggest } = await search;
    const state = { ...defaultState };
    for (const key of Object.keys(state)) {
      const value = req.body.state?.[key];
      if (typeof value === typeof state[key]) state[key] = typeof value === 'string' ? value.slice(0, 200) : value;
    }
    const rows = await Voter.find({}, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 }).sort({ i: 1 }).lean();
    const edits = Object.fromEntries((await Edit.find().lean()).map(e => [e.i, e]));
    const ctx = prepare(rows, edits);
    const result = run(ctx, state);
    const page = Math.min(Math.max(0, Math.floor(Number(req.body.page) || 0)), Math.max(0, Math.ceil(result.RES.length / 30) - 1));
    const visible = result.RES.slice(page * 30, (page + 1) * 30);
    const counts = {};
    ctx.DATA.filter(r => !r.d && (!state.ward || r.w === +state.ward)).forEach(r => {
      if (r.m) counts[r.m] = (counts[r.m] || 0) + 1;
    });
    const records = state.view === 'family' ? visible.flatMap(f => f.mem) : visible;
    res.set('Cache-Control', 'no-store');
    res.json({
      records, result: { ...result, RES: visible, MATCH: result.MATCH ? [...result.MATCH].filter(i => records.some(r => r.i === i)) : null },
      total: result.RES.length, page, wards: ctx.WARDS, active: ctx.ACT, families: ctx.FAMCOUNT,
      mohallas: Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
      suggestions: suggest(ctx, state, state.smode === 'pita' ? 'r' : 'n'),
      suggestions2: state.smode === 'dono' ? suggest(ctx, state, 'r') : []
    });
  } catch (error) { next(error); }
});


// GET /api/voters  -> full dataset used for client-side fuzzy search
router.get('/', authRequired, adminRequired, async (req, res) => {
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
