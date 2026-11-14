const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID, createHash } = require('crypto');
const User = require('../models/User');
const OtpRate = require('../models/OtpRate');
const { credentials, verifyRequest } = require('../services/twilio');
const router = express.Router();

router.use(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    credentials();
    const bucket = Math.floor(Date.now() / 3600000);
    const key = createHash('sha256').update(req.ip || 'unknown').digest('hex') + ':' + bucket;
    const rate = await OtpRate.findOneAndUpdate({ _id: key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 3600000) } },
      { upsert: true, new: true });
    if (rate.count > 30) return res.status(429).json({ error: 'otp_rate_limit' });
    next();
  } catch (error) { res.status(503).json({ error: error.message === 'otp_unavailable' ? 'otp_unavailable' : 'otp_provider_error' }); }
});

router.post('/request', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const mobile = String(req.body.mobile || '').trim();
  const channel = req.body.channel;
  if (!username || username.length > 100 || !/^[0-9]{10}$/.test(mobile) || channel !== 'sms') {
    return res.status(400).json({ error: 'invalid_recovery_details' });
  }
  const id = randomUUID();
  try {
    // Only the number already saved on this account may receive its reset code.
    const user = await User.findOneAndUpdate({
      username, mobile, active: true,
      $or: [{ resetRequestedAt: { $exists: false } }, { resetRequestedAt: { $lt: new Date(Date.now() - 60000) } }],
    }, { $set: {
      resetRequestedAt: new Date(),
      passwordReset: { id, mobile, expiresAt: new Date(Date.now() + 10 * 60000), attempts: 0 },
    } }, { new: true });
    if (user) {
      const verification = await verifyRequest('Verifications', { To: '+91' + mobile, Channel: channel });
      if (verification.status !== 'pending' || !verification.sid) throw new Error('otp_provider_error');
      await User.updateOne({ _id: user._id, 'passwordReset.id': id, mobile, passwordHash: user.passwordHash },
        { $set: { 'passwordReset.sid': verification.sid, 'passwordReset.passwordHash': user.passwordHash } });
    }
    // Same response for unknown accounts and numbers, and for cooldown requests.
    res.json({ requestId: id, message: 'यदि आईडी और सेव किया नंबर सही हैं तो OTP मिलेगा। दोबारा भेजने से पहले 60 सेकंड रुकें।' });
  } catch {
    await User.updateOne({ 'passwordReset.id': id }, { $unset: { passwordReset: 1 } }).catch(() => {});
    res.status(503).json({ error: 'otp_provider_error' });
  }
});

router.post('/confirm', async (req, res) => {
  const { requestId, code, newPassword } = req.body || {};
  if (typeof requestId !== 'string' || typeof code !== 'string' || !/^[0-9]{4,10}$/.test(code) ||
      typeof newPassword !== 'string' || newPassword.length < 6 || Buffer.byteLength(newPassword) > 72) {
    return res.status(400).json({ error: 'invalid_reset_details' });
  }
  try {
    const user = await User.findOneAndUpdate({
      active: true, 'passwordReset.id': requestId, 'passwordReset.sid': { $exists: true },
      'passwordReset.expiresAt': { $gt: new Date() }, 'passwordReset.attempts': { $lt: 5 },
    }, { $inc: { 'passwordReset.attempts': 1 } }, { new: true });
    if (!user) return res.status(400).json({ error: 'invalid_otp' });
    const result = await verifyRequest('VerificationCheck', { VerificationSid: user.passwordReset.sid, Code: code });
    if (result.status !== 'approved') return res.status(400).json({ error: 'invalid_otp' });
    const changed = await User.updateOne({
      _id: user._id, active: true, mobile: user.passwordReset.mobile,
      passwordHash: user.passwordReset.passwordHash, 'passwordReset.id': requestId,
      'passwordReset.expiresAt': { $gt: new Date() },
    }, { $set: { passwordHash: await bcrypt.hash(newPassword, 10), sessions: [] }, $unset: { passwordReset: 1 } });
    if (!changed.modifiedCount) return res.status(400).json({ error: 'invalid_otp' });
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message === 'invalid_otp' ? 'invalid_otp' : 'otp_provider_error' });
  }
});

module.exports = router;
