const mongoose = require('mongoose');

/**
 * A subscription request raised from the login screen
 * (the legacy app sent these to the owner over WhatsApp).
 */
const subscribeRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    village: { type: String, trim: true, default: '' },
    loginId: { type: String, trim: true, lowercase: true, required: true },
    plan: { type: String, default: '₹5,000 / माह' },
    note: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscribeRequest', subscribeRequestSchema);
