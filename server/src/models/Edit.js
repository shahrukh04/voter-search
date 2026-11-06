const mongoose = require('mongoose');

/**
 * A manual correction of a voter's serial number (क्रमांक) or ward.
 * These are global (shared by every user of the app), matching the way the
 * legacy app's corrections were meant to be applied everywhere.
 */
const editSchema = new mongoose.Schema(
  {
    i: { type: Number, required: true, unique: true, index: true }, // voter index
    n: { type: String, required: true }, // voter name, guard against index drift
    w: { type: Number, required: true }, // corrected ward
    s: { type: String, required: true }, // corrected serial
    by: { type: String }, // username that made the change
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Edit', editSchema);
