const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const { randomUUID } = require('crypto');

function describeClient(agent = '') {
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
  return { kind, browser };
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
    const session = { device, sid, loginAt: now, ...describeClient(req.get('user-agent')), expiresAt: new Date(jwt.decode(token).exp * 1000) };
    // Check capacity and replace this browser's session in one atomic update.
    const others = { $filter: {
      input: { $ifNull: ['$sessions', []] }, as: 's',
      cond: { $and: [{ $gt: ['$$s.expiresAt', now] }, { $ne: ['$$s.device', device] }] }
    } };
    const updated = await User.findOneAndUpdate({
      _id: user._id, active: true, passwordHash: user.passwordHash, expiresAt: user.expiresAt,
      $expr: { $lt: [{ $size: others }, { $ifNull: ['$deviceLimit', 2] }] }
    }, [{ $set: { lastLoginAt: now, sessions: { $concatArrays: [others, [session]] } } }], { new: true });
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

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = router;
