require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { connectDB } = require('../config/db');
const Voter = require('../models/Voter');
const Edit = require('../models/Edit');
const User = require('../models/User');

const DATA_FILE = process.env.VOTERS_FILE || path.join(__dirname, 'voters.json');

function normRecord(r, index) {
  const age = r.a === null || r.a === undefined || r.a === '' ? null : Number(r.a);
  return {
    i: index,
    n: String(r.n ?? '').trim(),
    rn: String(r.rn ?? '').trim(),
    rel: String(r.rel ?? '').trim(),
    a: Number.isFinite(age) ? age : null,
    g: String(r.g ?? '').trim(),
    w: Number(r.w) || 0,
    h: String(r.h ?? '').trim(),
    m: String(r.m ?? '').trim(),
    e: String(r.e ?? '').trim(),
    s: String(r.s ?? '').trim(),
    l: String(r.l ?? '').trim(),
    d: !!r.d,
  };
}

async function seedVoters() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`✗ Voters file not found: ${DATA_FILE}`);
    console.error('  Run `npm run decode -- <loginId> <password>` first.');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.voters || raw.records || [];
  if (!list.length) {
    console.error('✗ No voter records found in', DATA_FILE);
    process.exit(1);
  }

  const voters = list.map(normRecord);
  console.log(`→ Importing ${voters.length} voter records...`);

  await Voter.deleteMany({});
  // Insert in chunks to stay well under the 16MB BSON limit per batch.
  const CHUNK = 1000;
  for (let k = 0; k < voters.length; k += CHUNK) {
    await Voter.insertMany(voters.slice(k, k + CHUNK), { ordered: true });
  }

  // A fresh data set invalidates any corrections tied to old indices.
  await Edit.deleteMany({});
  console.log(`✓ Voters imported: ${voters.length} (corrections cleared)`);
}

async function seedAdmin() {
  const username = (process.env.ADMIN_USERNAME || 'shahrukh').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'change-me-123';
  const name = process.env.ADMIN_NAME || 'Shahrukh (Admin)';

  const passwordHash = await bcrypt.hash(password, 10);
  await User.findOneAndUpdate(
    { username },
    {
      username,
      passwordHash,
      name,
      role: 'admin',
      active: true,
      expiresAt: new Date('9999-12-31T00:00:00Z'),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✓ Admin user ready -> ${username} / ${password}`);
}

async function main() {
  const usersOnly = process.argv.includes('--users-only');
  await connectDB(process.env.MONGODB_URI);

  if (!usersOnly) await seedVoters();
  await seedAdmin();

  await mongoose.connection.close();
  console.log('✓ Done.');
}

main().catch(async (e) => {
  console.error('✗ Seed failed:', e);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
