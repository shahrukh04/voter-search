const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    active: { type: Boolean, default: true },
    // Subscription end date. Admin perpetual accounts use a far-future date.
    expiresAt: { type: Date, required: true },
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
    active: this.active,
    expiresAt: this.expiresAt,
  };
};

module.exports = mongoose.model('User', userSchema);
