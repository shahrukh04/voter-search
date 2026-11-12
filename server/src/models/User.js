const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    mobile: { type: String, default: '' },
    active: { type: Boolean, default: true },
    // Subscription end date. Admin perpetual accounts use a far-future date.
    expiresAt: { type: Date, required: true },
    deviceLimit: { type: Number, default: 2 },
    sessions: [{ _id: false, device: String, sid: String, expiresAt: Date, loginAt: Date, kind: String, browser: String, deviceName: String }],
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.isSubscriptionValid = function () {
  return this.active && this.expiresAt && this.expiresAt.getTime() >= Date.now();
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    username: this.username,
    name: this.name,
    role: this.role,
    mobile: this.mobile || '',
    superAdmin: this.username === 'srk' && this.role === 'admin',
    active: this.active,
    expiresAt: this.expiresAt,
  };
};

userSchema.methods.toAdminJSON = function () {
  const devices = this.isSubscriptionValid()
    ? this.sessions.filter(s => s.expiresAt > new Date()).map(s => ({
        id: s.sid, deviceName: s.deviceName || null, kind: s.kind || 'unknown', browser: s.browser || null, loginAt: s.loginAt || null
      })) : [];
  return { ...this.toSafeJSON(), deviceLimit: this.deviceLimit, devices, signedInDevices: devices.length, lastLoginAt: this.lastLoginAt };
};

module.exports = mongoose.model('User', userSchema);
