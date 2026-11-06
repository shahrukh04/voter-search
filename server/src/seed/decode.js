/**
 * One-time script: decrypt the legacy HTML app's encrypted voter data.
 *
 * The old `jaliya_admin.html` shipped its data as an AES-GCM blob whose key was
 * wrapped with a PBKDF2 key derived from `loginId:password`. This script
 * reproduces that exact scheme and writes a plain `voters.json`.
 *
 * Usage:
 *   node decode.js <loginId> <password> [blobPath] [outPath]
 */
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const subtle = webcrypto.subtle;
const enc = new TextEncoder();

const b64 = (s) => Uint8Array.from(Buffer.from(s, 'base64'));

async function deriveKek(id, pw, salt, iterations) {
  const base = await subtle.importKey(
    'raw',
    enc.encode(id.trim().toLowerCase() + ':' + pw),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function unwrapUser(id, pw, user, iterations) {
  const kek = await deriveKek(id, pw, b64(user.salt), iterations);
  const raw = await subtle.decrypt(
    { name: 'AES-GCM', iv: b64(user.iv), additionalData: enc.encode(user.exp + '|' + user.nm) },
    kek,
    b64(user.wk)
  );
  return new Uint8Array(raw);
}

async function openData(rawKey, blob) {
  const key = await subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.div) }, key, b64(blob.d));
  return JSON.parse(new TextDecoder().decode(pt));
}

async function main() {
  const [id, pw, blobPath, outPath] = process.argv.slice(2);
  if (!id || !pw) {
    console.error('Usage: node decode.js <loginId> <password> [blobPath] [outPath]');
    process.exit(1);
  }

  const blobFile = blobPath || path.join(__dirname, 'blob.json');
  const blob = JSON.parse(fs.readFileSync(blobFile, 'utf8'));

  let raw = null;
  for (const user of blob.users) {
    try {
      raw = await unwrapUser(id, pw, user, blob.it);
      break;
    } catch (e) {
      /* try next user */
    }
  }
  if (!raw) {
    console.error('❌ Login failed — wrong id/password.');
    process.exit(2);
  }

  const data = await openData(raw, blob);
  const records = Array.isArray(data) ? data : data.voters || data.records || [];

  const out = outPath || path.join(__dirname, 'voters.json');
  fs.writeFileSync(out, JSON.stringify(records, null, 0));

  console.log('✓ Decrypted', records.length, 'voter records ->', out);
  console.log('Sample:', JSON.stringify(records[0], null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
