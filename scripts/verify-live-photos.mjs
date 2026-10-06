import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const statePath = process.env.BRISA_TEST_STATE || '/tmp/brisa-delivery-tests.json';
const state = JSON.parse(await readFile(statePath));
const image = await readFile('docs/screenshots/android-group-chat.png');
const token = state.accounts[0].idToken;
async function call(path, body, expected = 200) {
  const r = await fetch('https://brisa-api-ral6.onrender.com' + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const v = await r.json();
  assert.equal(r.status, expected, v.error);
  return v;
}
const photo = await call('/photos/uploads', { mimeType: 'image/png', size: image.length });
const publicUrl = new URL(photo.photoUrl);
assert.equal(publicUrl.hostname, 'dcsiztcuyzxskugdydpf.supabase.co');
const path = publicUrl.pathname.split('/brisa-photos/')[1];
assert.ok(path.startsWith(state.accounts[0].localId + '/'));
state.uploads.push(path);
state.supabaseProjectRef = 'dcsiztcuyzxskugdydpf';
await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
const upload = await fetch(photo.uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' },
  body: image,
  signal: AbortSignal.timeout(60000),
});
assert.ok(upload.ok, `Upload HTTP ${upload.status}`);
console.log('PASS signed PNG upload');
const downloaded = await fetch(photo.photoUrl);
assert.ok(downloaded.ok);
assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), image);
console.log('PASS downloaded image bytes match');
const profile = await fetch('https://brisa-api-ral6.onrender.com/users/me', {
  method: 'PUT',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Teste entrega Brisa 1',
    phoneNumber: '11999999999',
    birthDate: '2000-01-01',
    photoUrl: photo.photoUrl,
  }),
  signal: AbortSignal.timeout(90000),
});
assert.equal(profile.status, 200);
assert.equal((await profile.json()).photoUrl, photo.photoUrl);
console.log('PASS profile stores final URL');
const id = 'group_' + randomUUID();
state.conversations.push({ id, type: 'group' });
await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
const group = await call(
  '/groups',
  {
    id,
    group: {
      name: 'Teste fotos Supabase',
      photoUrl: photo.photoUrl,
      memberIds: [state.accounts[0].localId, state.accounts[1].localId],
      memberLimit: 2,
      notificationPolicy: 'disabled',
    },
  },
  201,
);
assert.equal(group.photoUrl, photo.photoUrl);
console.log('PASS group stores final URL');
await call('/photos/uploads', { mimeType: 'image/png', size: 5242880 }, 400);
console.log('PASS API rejects 5 MB image');
if (process.argv.includes('--oversize')) {
  const smallGrant = await call('/photos/uploads', { mimeType: 'image/png', size: 100 });
  const oversized = await fetch(smallGrant.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: Buffer.alloc(5242880),
  });
  if (oversized.ok) {
    state.uploads.push(new URL(smallGrant.photoUrl).pathname.split('/brisa-photos/')[1]);
    await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
  }
  assert.ok(!oversized.ok);
  console.log('PASS Supabase rejects actual 5 MB upload with understated size');
}
const replay = await fetch(photo.uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' },
  body: image,
});
assert.ok(!replay.ok);
console.log('PASS signed upload cannot overwrite');
const { stdout } = await promisify(execFile)('supabase', [
  'projects',
  'api-keys',
  '--project-ref',
  'dcsiztcuyzxskugdydpf',
  '--output',
  'json',
]);
const anon = JSON.parse(stdout).find((x) => x.name === 'anon')?.api_key;
assert.ok(anon);
const unauthorized = await fetch(
  `https://${publicUrl.hostname}/storage/v1/object/brisa-photos/${state.accounts[0].localId}/unauthorized.png`,
  {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'image/png' },
    body: image,
  },
);
assert.ok(!unauthorized.ok);
assert.match((await unauthorized.json()).message, /row-level security/i);
console.log('PASS anonymous key cannot write images');
console.log('Photo API checks complete.');
