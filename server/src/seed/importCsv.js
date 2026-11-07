require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

const { connectDB } = require('../config/db');
const Voter = require('../models/Voter');

/**
 * Import ward voter lists from CSV files into the existing collection.
 *
 *   node src/seed/importCsv.js --dry "1=path/to/ward1.csv" "2=path/to/ward2.csv"
 *   node src/seed/importCsv.js        "1=path/to/ward1.csv" "2=path/to/ward2.csv"
 *
 * Records are never touched outside the wards being imported, so the
 * originally decoded dataset stays intact. Re-running a ward replaces it.
 *
 * Supported CSV layouts (auto-detected):
 *   A  सूची भाग, क्रम संख्या, मार्कर, स्थिति, EPIC, नाम, संबंध, संबंधी का नाम, मकान, आयु, लिंग, मोहल्ला, पेज
 *   B  क्रम संख्या, EPIC, नाम, संबंध, पिता/पति/माता का नाम, मकान, आयु, लिंग, मोहल्ला, नामावली का प्रकार, स्थिति
 *   C  serial_no, voter_id, name, relation_type, relation_name, house_no, age, gender, locality, status, list_source
 *   D  Serial_No, Voter_ID_EPIC, Name, Relation_Type, Relation_Name, House_No, Age, Gender, Gali, List, Status
 */

/** Ward number → column offsets for each supported header layout. */
const LAYOUTS = {
  A: { list: 0, serial: 1, marker: 2, status: 3, epic: 4, name: 5, rel: 6, rn: 7, house: 8, age: 9, gender: 10, m: 11 },
  B: { serial: 0, epic: 1, name: 2, rel: 3, rn: 4, house: 5, age: 6, gender: 7, m: 8, list: 9, status: 10 },
  C: { serial: 0, epic: 1, name: 2, rel: 3, rn: 4, house: 5, age: 6, gender: 7, m: 8, status: 9, list: 10 },
  D: { serial: 0, epic: 1, name: 2, rel: 3, rn: 4, house: 5, age: 6, gender: 7, m: 8, list: 9, status: 10 },
};

function detectLayout(header) {
  const sig = header.join('|').toLowerCase();
  if (sig.includes('सूची भाग')) return 'A';
  if (sig.includes('नामावली का प्रकार')) return 'B';
  if (sig.includes('list_source')) return 'C';
  if (sig.includes('voter_id_epic') || (sig.includes('serial') && sig.includes('gali'))) return 'D';
  throw new Error('unrecognised CSV header -> ' + header.join(', '));
}

/** Minimal RFC4180 parser: quoted fields, embedded commas/newlines, "" escapes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

function normGender(v) {
  const s = clean(v).toLowerCase();
  if (s.startsWith('पुरुष') || s === 'male' || s === 'm') return 'पुरुष';
  if (s.startsWith('स्त्री') || s === 'female' || s === 'f') return 'स्त्री';
  return clean(v);
}

function normRel(v) {
  const s = clean(v).toLowerCase();
  if (s.startsWith('पिता') || s === 'father') return 'पिता';
  if (s.startsWith('पति') || s === 'husband') return 'पति';
  if (s.startsWith('माता') || s === 'mother') return 'माता';
  if (s.startsWith('अन्य') || s === 'other') return 'अन्य';
  return clean(v);
}

function normList(v) {
  const s = clean(v);
  if (!s) return '';
  return /मूल|original/i.test(s) ? 'मूल सूची' : 'परिवर्धन सूची';
}

/** The ward name is noise once the ward column already says which roll this is. */
function cleanMohalla(v) {
  let s = clean(v);
  s = s.replace(/[,，]\s*जालिया\s*[।.]*\s*$/u, '');
  s = s.replace(/[।.]+\s*$/u, '');
  return s.replace(/[,\s]+$/u, '').trim();
}

/** A row leaves the effective roll when it is shifted / deleted / inactive. */
function isDeleted(status, marker) {
  const mk = clean(marker).toUpperCase();
  if (mk === 'S' || mk === 'D') return true;
  const s = clean(status);
  if (!s) return false;
  if (/सक्रिय|active/i.test(s)) return false;
  return true;
}

function toVoter(cols, layout, ward, index) {
  const cell = (key) => (layout[key] === undefined ? '' : cols[layout[key]]);
  const age = parseInt(clean(cell('age')), 10);
  return {
    i: ward * 1000000 + index,
    n: clean(cell('name')),
    rn: clean(cell('rn')),
    rel: normRel(cell('rel')),
    a: Number.isFinite(age) ? age : null,
    g: normGender(cell('gender')),
    w: ward,
    h: clean(cell('house')),
    m: cleanMohalla(cell('m')),
    e: clean(cell('epic')),
    s: clean(cell('serial')),
    l: normList(cell('list')),
    d: isDeleted(cell('status'), cell('marker')),
  };
}

function readWardFile(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) throw new Error('empty CSV: ' + file);
  const layoutKey = detectLayout(rows[0]);
  const layout = LAYOUTS[layoutKey];
  const voters = rows.slice(1).map((cols, k) => toVoter(cols, layout, 0, k + 1));
  return { layoutKey, voters };
}

function parseArgs(argv) {
  const dry = argv.includes('--dry');
  const pairs = argv
    .filter((a) => !a.startsWith('--'))
    .map((a) => {
      const eq = a.indexOf('=');
      if (eq < 1) throw new Error('expected "ward=path", got: ' + a);
      return { ward: Number(a.slice(0, eq)), file: a.slice(eq + 1) };
    });
  return { dry, pairs };
}

async function main() {
  const { dry, pairs } = parseArgs(process.argv.slice(2));
  if (!pairs.length) {
    console.error('usage: node src/seed/importCsv.js [--dry] "1=ward1.csv" "2=ward2.csv" ...');
    process.exit(1);
  }
  const wards = pairs.map((p) => p.ward);
  if (new Set(wards).size !== wards.length) {
    console.error('✗ duplicate ward numbers in arguments');
    process.exit(1);
  }

  await connectDB(process.env.MONGODB_URI);

  for (const { ward, file } of pairs) {
    if (!Number.isInteger(ward) || ward <= 0) throw new Error('bad ward: ' + ward);
    if (!fs.existsSync(file)) throw new Error('file not found: ' + file);

    const { layoutKey, voters } = readWardFile(file);
    // Keep ids in a high per-ward band so they never clash with the decoded dataset.
    voters.forEach((v, k) => { v.w = ward; v.i = ward * 1000000 + k + 1; });
    const gone = voters.filter((v) => v.d).length;
    const mohallas = [...new Set(voters.map((v) => v.m))].filter(Boolean);

    console.log(
      `→ वार्ड ${ward}: ${voters.length} records (layout ${layoutKey}, ${gone} shifted/deleted) ` +
      `[${path_short(file)}]`
    );
    console.log(`  मोहल्ला: ${mohallas.join(' · ')}`);

    if (dry) continue;

    const removed = await Voter.deleteMany({ w: ward });
    const CHUNK = 500;
    for (let k = 0; k < voters.length; k += CHUNK) {
      await Voter.insertMany(voters.slice(k, k + CHUNK), { ordered: true });
    }
    console.log(`  ✓ saved (replaced ${removed.deletedCount} old records)`);
  }

  if (dry) {
    console.log('ℹ dry run — nothing written.');
  } else {
    const wards2 = (await Voter.distinct('w')).filter((w) => typeof w === 'number').sort((a, b) => a - b);
    const total = await Voter.countDocuments({ d: { $ne: true } });
    console.log(`✓ Done. Wards in DB: ${wards2.join(', ')} · active records: ${total}`);
  }

  await mongoose.connection.close();
}

const path = require('path');
const path_short = (p) => path.basename(p);

main().catch(async (e) => {
  console.error('✗ Import failed:', e.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
