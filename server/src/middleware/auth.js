const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'auth_required' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'invalid_token' });
    if (!user.isSubscriptionValid()) return res.status(403).json({ error: 'subscription_expired', expiresAt: user.expiresAt });

    if (!payload.sid || !user.sessions.some(s => s.sid === payload.sid && s.expiresAt > new Date())) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    req.sid = payload.sid;
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin_only' });
  }
  next();
}

module.exports = { authRequired, adminRequired };
