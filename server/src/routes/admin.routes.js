const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SubscribeRequest = require('../models/SubscribeRequest');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

function targetFilter(req) {
  const filter = { username: { $ne: 'srk' } };
  if (!req.user.toSafeJSON().superAdmin) filter.role = 'user';
  return filter;
}

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

  if (username === 'srk') throw new Error('protected_account');
  return User.findOneAndUpdate(
    { username, role: 'user' },
    {
      $setOnInsert: { mobile: String(doc.mobile || '').trim() },
      username,
      passwordHash,
      sessions: [],
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
  res.json({ users: users.map((u) => u.toAdminJSON()) });
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

    const authority = targetFilter(req);
    if (uname === 'srk' || (authority.role && role === 'admin')) return res.sendStatus(403);
    let user = await User.findOne({ username: uname });
    if (user && authority.role && user.role !== 'user') return res.sendStatus(403);
    if (user) user.$where = authority;
    if (!user) {
      if (!password || String(password).length < 4) return res.status(400).json({ error: 'weak_password' });
      user = new User({ username: uname });
    }
    user.name = String(name).trim();
    user.role = role === 'admin' ? 'admin' : 'user';
    user.expiresAt = exp;
    user.active = true;
    if (password) {
      user.passwordHash = await bcrypt.hash(String(password), 10);
      user.sessions = [];
    }

    await user.save();
    res.json({ ok: true, user: user.toAdminJSON() });
  } catch (e) {
    console.error('admin upsert user error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// PATCH /api/admin/users/:id  { expiresAt?, active?, password?, role? }
router.patch('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'not_found' });

    const { expiresAt, active, password, role } = req.body || {};
    const authority = targetFilter(req);
    if (user.username === 'srk' || (authority.role && (user.role !== 'user' || role === 'admin'))) return res.sendStatus(403);
    user.$where = authority;
    if (expiresAt) {
      const exp = new Date(expiresAt);
      if (isNaN(exp.getTime())) return res.status(400).json({ error: 'invalid_expires_at' });
      user.expiresAt = exp;
    }
    if (typeof active === 'boolean') user.active = active;
    if (active === false) user.sessions = [];
    if (role === 'admin' || role === 'user') user.role = role;
    if (password) {
      user.passwordHash = await bcrypt.hash(String(password), 10);
      user.sessions = [];
    }

    await user.save();
    res.json({ ok: true, user: user.toAdminJSON() });
  } catch (e) {
    console.error('admin patch user error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

router.delete('/users/:id', async (req, res, next) => {
  if (!req.user.toSafeJSON().superAdmin) return res.sendStatus(403);
  try {
    const deleted = await User.findOneAndDelete({ _id: req.params.id, ...targetFilter(req) });
    if (!deleted) return res.sendStatus(404);
    res.sendStatus(204);
  } catch (error) { next(error); }
});

router.delete('/users/:id/sessions/:sid', async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, ...targetFilter(req) },
      { $pull: { sessions: { sid: req.params.sid } } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json({ user: user.toAdminJSON() });
  } catch (error) { next(error); }
});

router.put('/users/:id/device-limit', async (req, res, next) => {
  try {
    const limit = req.body.deviceLimit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      return res.status(400).json({ error: 'invalid_device_limit' });
    }
    const valid = { $filter: { input: { $ifNull: ['$sessions', []] }, as: 's',
      cond: { $gt: ['$$s.expiresAt', new Date()] } } };
    const user = await User.findOneAndUpdate({ _id: req.params.id, ...targetFilter(req) }, [
      { $set: { deviceLimit: limit, sessions: { $slice: [valid, -limit] } } }
    ], { new: true });
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json({ user: user.toAdminJSON() });
  } catch (error) { next(error); }
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


    let user = null;
    if (status === 'approved' && !wasApproved) {
      user = await provisionUserFromRequest(doc);
    }

    doc.status = status;
    await doc.save();
    res.json({ ok: true, request: doc, user: user ? user.toAdminJSON() : null });
  } catch (e) {
    if (e.code === 11000 || e.message === 'protected_account') return res.status(409).json({ error: 'protected_account' });
    console.error('admin patch request error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
