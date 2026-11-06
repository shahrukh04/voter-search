const express = require('express');
const SubscribeRequest = require('../models/SubscribeRequest');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

// POST /api/subscribe -> public, raised from the login screen
router.post('/', async (req, res) => {
  try {
    const { name, mobile, village, loginId, password, plan, note } = req.body || {};
    const uname = String(loginId || '').trim();
    const pass = String(password || '');
    if (!uname || !/^[0-9]{10}$/.test(String(mobile || '')) || pass.length < 4) {
      return res.status(400).json({ error: 'invalid_request' });
    }
    const doc = await SubscribeRequest.create({
      name: String(name || uname).trim(),
      mobile: String(mobile).trim(),
      village: String(village || '').trim(),
      loginId: uname,
      password: pass,
      plan: plan || '₹5,000 / माह',
      note: note || '',
    });
    res.status(201).json({ ok: true, id: doc._id });
  } catch (e) {
    console.error('subscribe error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/subscribe -> admin only
router.get('/', authRequired, adminRequired, async (_req, res) => {
  try {
    const items = await SubscribeRequest.find().sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch (e) {
    console.error('subscribe list error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
