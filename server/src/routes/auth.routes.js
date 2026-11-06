const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  // Token is valid no longer than the subscription itself.
  const secondsLeft = Math.max(60, Math.floor((user.expiresAt.getTime() - Date.now()) / 1000));
  const expiresIn = Math.min(secondsLeft, 30 * 24 * 60 * 60); // cap at 30 days
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn });
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

    user.lastLoginAt = new Date();
    await user.save();

    return res.json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = router;
