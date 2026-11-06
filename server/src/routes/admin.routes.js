const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SubscribeRequest = require('../models/SubscribeRequest');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired, adminRequired);

// GET /api/admin/users
router.get('/users', async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users: users.map((u) => u.toSafeJSON()) });
});

// POST /api/admin/users  { username, password, name, expiresAt, role }
// Creates a user, or updates the password / expiry of an existing one.
router.post('/users', async (req, res) => {
  try {
    const { username, password, name, expiresAt, role } = req.body || {};
    if (!username || !name || !expiresAt) return res.status(400).json({ error: 'missing_fields' });

    const uname = String(username).trim().toLowerCase();
    const exp = new Date(expiresAt);
    if (isNaN(exp.getTime())) return res.status(400).json({ error: 'invalid_expires_at' });

    let user = await User.findOne({ username: uname });
    if (!user) {
      if (!password || String(password).length < 4) return res.status(400).json({ error: 'weak_password' });
      user = new User({ username: uname });
    }
    user.name = String(name).trim();
    user.role = role === 'admin' ? 'admin' : 'user';
    user.expiresAt = exp;
    user.active = true;
    if (password) user.passwordHash = await bcrypt.hash(String(password), 10);

    await user.save();
    res.json({ ok: true, user: user.toSafeJSON() });
  } catch (e) {
    console.error('admin upsert user error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// PATCH /api/admin/users/:id  { expiresAt?, active?, password? }
router.patch('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'not_found' });

    const { expiresAt, active, password } = req.body || {};
    if (expiresAt) {
      const exp = new Date(expiresAt);
      if (isNaN(exp.getTime())) return res.status(400).json({ error: 'invalid_expires_at' });
      user.expiresAt = exp;
    }
    if (typeof active === 'boolean') user.active = active;
    if (password) user.passwordHash = await bcrypt.hash(String(password), 10);

    await user.save();
    res.json({ ok: true, user: user.toSafeJSON() });
  } catch (e) {
    console.error('admin patch user error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// PATCH /api/admin/requests/:id  { status }
router.patch('/requests/:id', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }
    const doc = await SubscribeRequest.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, request: doc });
  } catch (e) {
    console.error('admin patch request error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
