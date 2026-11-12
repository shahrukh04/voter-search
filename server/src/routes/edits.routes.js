const express = require('express');
const Voter = require('../models/Voter');
const Edit = require('../models/Edit');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

// GET /api/edits -> { i: {n,w,s} } map (mirrors the legacy EDITS object)
router.get('/', authRequired, adminRequired, async (_req, res) => {
  try {
    const edits = await Edit.find({}, { _id: 0, i: 1, n: 1, w: 1, s: 1 }).lean();
    const map = {};
    edits.forEach((e) => {
      map[e.i] = { n: e.n, w: e.w, s: e.s };
    });
    res.json({ edits: map });
  } catch (e) {
    console.error('edits get error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// PUT /api/edits  body: { edits: { "<i>": {n,w,s} } }  -> replaces the whole set
// क्रमांक/वार्ड सुधार केवल एडमिन बदल सकता है।
router.put('/', authRequired, adminRequired, async (req, res) => {
  try {
    const incoming = (req.body && req.body.edits) || {};
    const keys = Object.keys(incoming);
    if (keys.length > 20000) return res.status(400).json({ error: 'too_many_edits' });

    const indices = keys.map(Number).filter(Number.isInteger);
    const voters = await Voter.find({ i: { $in: indices } }, { i: 1, n: 1, _id: 0 }).lean();
    const byIndex = new Map(voters.map((v) => [v.i, v]));

    const docs = [];
    for (const key of keys) {
      const i = Number(key);
      const e = incoming[key];
      const voter = byIndex.get(i);
      if (!voter || !e) continue;
      // The name must match — protects against index drift after a re-seed.
      if (e.n && e.n !== voter.n) continue;
      const w = Number(e.w);
      const s = String(e.s ?? '').trim();
      if (!Number.isInteger(w) || w < 1 || w > 99 || !s) continue;
      docs.push({ i, n: voter.n, w, s, by: req.user.username });
    }

    await Edit.deleteMany({});
    if (docs.length) await Edit.insertMany(docs);

    res.json({ ok: true, count: docs.length });
  } catch (e) {
    console.error('edits put error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/edits -> clear all corrections (एडमिन के लिए)
router.delete('/', authRequired, adminRequired, async (_req, res) => {
  try {
    await Edit.deleteMany({});
    res.json({ ok: true, count: 0 });
  } catch (e) {
    console.error('edits delete error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
