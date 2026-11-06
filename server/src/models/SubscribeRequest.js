const mongoose = require('mongoose');

/**
 * A subscription request raised from the login screen
 * (the legacy app sent these to the owner over WhatsApp).
 */
const subscribeRequestSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    mobile: { type: String, required: true, trim: true },
    village: { type: String, trim: true, default: '' },
    loginId: { type: String, trim: true, lowercase: true, required: true },
    // Kept so the admin can hand the credentials back over WhatsApp on approval.
    password: { type: String, default: '' },
    plan: { type: String, default: '₹5,000 / माह' },
    note: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscribeRequest', subscribeRequestSchema);
