const mongoose = require('mongoose');

// Shared across app instances. Expired entries are also excluded before TTL cleanup.
const schema = new mongoose.Schema({
  _id: String,
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, expires: 0 },
});
module.exports = mongoose.model('OtpRate', schema);
