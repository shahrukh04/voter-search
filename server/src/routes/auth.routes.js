const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use('/recovery', require('./recovery.routes'));

const { randomUUID } = require('crypto');

function describeClient(agent = '', model) {
  const browsers = [
    [/Edg(?:A|iOS)?\//i, 'Edge'], [/SamsungBrowser\//i, 'Samsung Internet'],
    [/OPR\/|Opera Mini|OPiOS/i, 'Opera'], [/Firefox\/|FxiOS\//i, 'Firefox'],
    [/Chrome\/|CriOS\//i, 'Chrome'], [/Safari\//i, 'Safari']
  ];
  const browser = browsers.find(([pattern]) => pattern.test(agent))?.[1] || 'Unknown';
  let kind = 'unknown';
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(agent)) kind = 'tablet';
  else if (/Mobile|iPhone|Windows Phone/i.test(agent)) kind = 'phone';
  else if (/Windows NT|Macintosh|X11|CrOS/i.test(agent)) kind = 'computer';
  const platforms = [[/iPhone/, 'iPhone'], [/iPad/, 'iPad'], [/Android/, 'Android'], [/Windows/, 'Windows PC'],
    [/Macintosh/, 'Mac'], [/CrOS/, 'Chromebook'], [/Linux/, 'Linux PC']];
  const deviceName = typeof model === 'string' && model.trim() ? model.trim().slice(0, 80)
    : platforms.find(([pattern]) => pattern.test(agent))?.[1] || null;
  return { kind, browser, deviceName };
}

function signToken(user, sid) {
  // Token is valid no longer than the subscription itself.
  const secondsLeft = Math.max(60, Math.floor((user.expiresAt.getTime() - Date.now()) / 1000));
  const expiresIn = Math.min(secondsLeft, 30 * 24 * 60 * 60); // cap at 30 days
  return jwt.sign({ sub: String(user._id), role: user.role, sid }, process.env.JWT_SECRET, { expiresIn });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'missing_credentials' });

    const user = await User.findOne({ username: String(username).trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    if (!user.isSubscriptionValid()) {
      return res.status(403).json({
        error: 'subscription_expired',
        expiresAt: user.expiresAt,
        name: user.name,
      });
    }

    const device = req.body.deviceId || randomUUID();
    if (typeof device !== 'string' || !/^[a-z0-9-]{16,80}$/i.test(device)) {
      return res.status(400).json({ error: 'invalid_device' });
    }
    const sid = randomUUID();
    const token = signToken(user, sid);
    const now = new Date();
    const session = { device, sid, loginAt: now, ...describeClient(req.get('user-agent'), req.body.model), expiresAt: new Date(jwt.decode(token).exp * 1000) };
    // Check capacity and replace this browser's session in one atomic update.
    const others = { $filter: {
      input: { $ifNull: ['$sessions', []] }, as: 's',
      cond: { $and: [{ $gt: ['$$s.expiresAt', now] }, { $ne: ['$$s.device', device] }] }
    } };
    const updated = await User.findOneAndUpdate({
      _id: user._id, active: true, passwordHash: user.passwordHash, expiresAt: user.expiresAt,
      $expr: { $lt: [{ $size: others }, { $ifNull: ['$deviceLimit', 2] }] }
    }, [{ $set: { lastLoginAt: now, sessions: { $concatArrays: [others, { $literal: [session] }] } } }], { new: true });
    if (!updated) return res.status(409).json({ error: 'device_limit_reached' });
    return res.json({ token, user: updated.toSafeJSON() });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/logout', authRequired, async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $pull: { sessions: { sid: req.sid } } });
    res.sendStatus(204);
  } catch (error) { next(error); }
});

router.post('/change-password', authRequired, async (req, res, next) => {
  try {
    const { oldPassword, newPassword, mobile } = req.body || {};
    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' ||
        newPassword.length < 6 || newPassword.length > 72 || Buffer.byteLength(newPassword) > 72) {
      return res.status(400).json({ error: 'invalid_password' });
    }
    if (mobile !== undefined && !/^[0-9]{10}$/.test(mobile)) return res.status(400).json({ error: 'invalid_mobile' });
    if (!await bcrypt.compare(oldPassword, req.user.passwordHash)) {
      return res.status(400).json({ error: 'incorrect_password' });
    }
    const update = { passwordHash: await bcrypt.hash(newPassword, 10), sessions: [] };
    if (mobile !== undefined) update.mobile = mobile;
    const result = await User.updateOne(
      { _id: req.user._id, passwordHash: req.user.passwordHash }, { $set: update, $unset: { passwordReset: 1 } }
    );
    if (!result.modifiedCount) return res.status(409).json({ error: 'password_changed' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = router;
