const express = require('express');
const SubscribeRequest = require('../models/SubscribeRequest');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

// POST /api/subscribe -> public, raised from the login screen
router.post('/', async (req, res) => {
  try {
    const { name, mobile, village, loginId, plan, note } = req.body || {};
    if (!name || !/^[0-9]{10}$/.test(String(mobile || '')) || !loginId) {
      return res.status(400).json({ error: 'invalid_request' });
    }
    const doc = await SubscribeRequest.create({
      name: String(name).trim(),
      mobile: String(mobile).trim(),
      village: String(village || '').trim(),
      loginId: String(loginId).trim().toLowerCase(),
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
