const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SubscribeRequest = require('../models/SubscribeRequest');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/**
 * Provision (or reset) the account described by an approved subscription
 * request so the applicant can log in right away.
 */
async function provisionUserFromRequest(doc) {
  const username = String(doc.loginId || '').trim().toLowerCase();
  const password = String(doc.password || '');
  if (!username || password.length < 4) return null;

  const passwordHash = await bcrypt.hash(password, 10);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS);

  return User.findOneAndUpdate(
    { username },
    {
      username,
      passwordHash,
      name: String(doc.name || username).trim(),
      role: 'user',
      active: true,
      expiresAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

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
// Approving a request also creates (or refreshes) the matching user account.
router.patch('/requests/:id', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }
    const doc = await SubscribeRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not_found' });

    const wasApproved = doc.status === 'approved';
    doc.status = status;
    await doc.save();

    let user = null;
    if (status === 'approved' && !wasApproved) {
      user = await provisionUserFromRequest(doc);
    }

    res.json({ ok: true, request: doc, user: user ? user.toSafeJSON() : null });
  } catch (e) {
    console.error('admin patch request error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
