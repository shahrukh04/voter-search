const mongoose = require('mongoose');

/**
 * A single voter record from the electoral roll.
 * Field names mirror the legacy app so the search logic ports 1:1.
 *   i   - stable index (used as the record id everywhere in the UI)
 *   n   - name (नाम)
 *   rn  - relative's name (पिता/पति का नाम)
 *   rel - relation: पिता | पति | माता | अन्य
 *   a   - age (number, null when missing)
 *   g   - gender: पुरुष | स्त्री
 *   w   - ward number
 *   h   - house number (string)
 *   m   - mohalla (मोहल्ला)
 *   e   - EPIC / voter id
 *   s   - serial number in the roll (क्रमांक)
 *   l   - list label, e.g. "पूरक सूची" (empty for original roll)
 *   d   - deleted / विलोपित flag
 */
const voterSchema = new mongoose.Schema(
  {
    i: { type: Number, required: true, unique: true, index: true },
    details: { n: String, rn: String, rel: String, a: Number, g: String, h: String, m: String, e: String, l: String, d: Boolean },
    n: { type: String, default: '' },
    rn: { type: String, default: '' },
    rel: { type: String, default: '' },
    a: { type: Number, default: null },
    g: { type: String, default: '' },
    w: { type: Number, index: true },
    h: { type: String, default: '' },
    m: { type: String, default: '' },
    e: { type: String, default: '' },
    s: { type: String, default: '' },
    l: { type: String, default: '' },
    d: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

voterSchema.index({ w: 1, h: 1 });

module.exports = mongoose.model('Voter', voterSchema);
