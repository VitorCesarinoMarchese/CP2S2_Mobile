import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const config = JSON.parse(await readFile(new URL('../firebaseConfig.json', import.meta.url)));
const api = process.env.BRISA_TEST_API_URL || 'https://brisa-api-ral6.onrender.com';
const statePath = process.env.BRISA_TEST_STATE || '/tmp/brisa-delivery-tests.json';
const phase = process.argv[2];

async function save(state) {
  await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
}

async function request(url, body, { token, method = 'POST', expected = 200 } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const value = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${new URL(url).pathname}: ${JSON.stringify(value)}`,
  );
  return value;
}

const authenticate = (action, body) =>
  request(
    `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${config.apiKey}`,
    body,
  );
const call = (state, index, path, body, options) =>
  request(api + path, body, { token: state.accounts[index].idToken, ...options });

async function googleClient(urlPrefix) {
  const auth = require('firebase-tools/lib/auth');
  const options = { project: config.projectId, nonInteractive: true };
  const account = auth.getGlobalDefaultAccount();
  assert.ok(account, 'Run firebase login with the Firebase project owner first.');
  auth.setActiveAccount(options, account);
  await require('firebase-tools/lib/requireAuth').requireAuth(options);
  const { Client } = require('firebase-tools/lib/apiv2');
  return new Client({ urlPrefix });
}

if (phase === '--setup') {
  await readFile(statePath).then(
    () => {
      throw new Error('Clean up the existing live test state first.');
    },
    () => {},
  );
  const state = { accounts: [], conversations: [], deliveries: [], uploads: [], checks: [] };
  await save(state);
  for (let index = 0; index < 3; index += 1) {
    const email = `brisa-delivery-${randomUUID()}@example.com`;
    const password = randomBytes(20).toString('hex');
    const session = await authenticate('signUp', { email, password, returnSecureToken: true });
    state.accounts.push({ email, password, localId: session.localId, idToken: session.idToken });
    await save(state);
    await call(
      state,
      index,
      '/users/me',
      {
        name: `Teste entrega Brisa ${index + 1}`,
        phoneNumber: '11999999999',
        birthDate: '2000-01-01',
        photoUrl: '',
      },
      { method: 'PUT' },
    );
  }
  console.log(`Created three temporary accounts. Private credentials are in ${statePath}.`);
  console.log('Sign account 0 into the Android app and allow notifications before --verify.');
} else if (phase === '--verify') {
  const state = JSON.parse(await readFile(statePath));
  for (const account of state.accounts) {
    const session = await authenticate('signInWithPassword', {
      email: account.email,
      password: account.password,
      returnSecureToken: true,
    });
    account.idToken = session.idToken;
  }
  await save(state);
  const firestore = await googleClient('https://firestore.googleapis.com');
  const documents = `/v1/projects/${config.projectId}/databases/(default)/documents/`;
  let registered = false;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const devices = await firestore.request({
      method: 'GET',
      path: `${documents}users/${state.accounts[0].localId}/devices`,
    });
    registered = devices.body.documents?.some(
      (device) => device.fields.enabled.booleanValue && device.fields.token.stringValue,
    );
    if (registered) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  assert.ok(registered, 'Account 0 must have a registered Android device.');
  const checked = async (label, action) => {
    await action();
    state.checks.push(label);
    await save(state);
    console.log(`PASS ${label}`);
  };
  const message = async (conversation, target = { type: 'conversation' }) => {
    const id = `test_${randomUUID().replaceAll('-', '')}`;
    await call(state, 1, `/conversations/${conversation.id}/messages`, {
      id,
      text: 'Teste real de entrega Brisa',
      target,
      mentionedUserIds: [],
    });
    state.deliveries.push({ conversationId: conversation.id, messageId: id });
    await save(state);
    return { conversationId: conversation.id, messageId: id };
  };
  const push = (body) => call(state, 1, '/notifications/messages', body);
  const direct = await call(state, 1, '/conversations/direct', {
    participantId: state.accounts[0].localId,
  });
  state.conversations.push({ id: direct.id, type: 'direct' });
  await save(state);
  await checked('Direct conversation uniqueness', async () => {
    const again = await call(state, 0, '/conversations/direct', {
      participantId: state.accounts[1].localId,
    });
    assert.equal(again.id, direct.id);
  });
  await checked('Direct FCM submission and duplicate protection', async () => {
    const body = await message(direct);
    assert.equal((await push(body)).delivered, 1);
    assert.equal((await push(body)).status, 'duplicate');
  });
  let input = {
    name: 'Grupo teste de entrega',
    photoUrl: '',
    memberIds: state.accounts.slice(0, 2).map((a) => a.localId),
    memberLimit: 2,
    notificationPolicy: 'all_group_messages',
  };
  const groupId = `group_test_${randomUUID().replaceAll('-', '')}`;
  state.conversations.push({ id: groupId, type: 'group' });
  await save(state);
  let group = await call(state, 0, '/groups', { id: groupId, group: input }, { expected: 201 });
  const update = async (next) => {
    group = await call(
      state,
      0,
      `/groups/${group.id}`,
      { group: next, expectedVersion: group.version },
      { method: 'PUT' },
    );
    input = next;
  };
  await checked('Capacity enforced by API', async () => {
    await call(
      state,
      0,
      `/groups/${group.id}`,
      {
        group: { ...input, memberIds: state.accounts.map((a) => a.localId) },
        expectedVersion: group.version,
      },
      { method: 'PUT', expected: 400 },
    );
  });
  await checked('Only owner can edit group', async () => {
    await call(
      state,
      1,
      `/groups/${group.id}`,
      { group: input, expectedVersion: group.version },
      { method: 'PUT', expected: 403 },
    );
  });
  await update({ ...input, memberLimit: 3, memberIds: state.accounts.map((a) => a.localId) });
  await checked('Limit cannot drop below membership', async () => {
    await call(
      state,
      0,
      `/groups/${group.id}`,
      { group: { ...input, memberLimit: 2 }, expectedVersion: group.version },
      { method: 'PUT', expected: 400 },
    );
  });
  await checked('Concurrent owner edits reject stale version', async () => {
    const version = group.version;
    const bodies = [4, 5].map((limit) => ({
      group: { ...input, memberLimit: limit },
      expectedVersion: version,
    }));
    const outcomes = await Promise.all(
      bodies.map(async (body) => {
        const response = await fetch(`${api}/groups/${group.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.accounts[0].idToken}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        });
        return { status: response.status, value: await response.json() };
      }),
    );
    assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [200, 409]);
    group = outcomes.find((outcome) => outcome.status === 200).value;
    input = { ...input, memberLimit: group.memberLimit };
    assert.equal(group.memberIds.length, 3);
  });
  await checked('all_group_messages submits to active recipient', async () =>
    assert.equal((await push(await message(group))).delivered, 1),
  );
  await update({ ...input, notificationPolicy: 'mentioned_members' });
  await checked('mentioned_members general message is silent', async () =>
    assert.equal((await push(await message(group))).delivered, 0),
  );
  await checked('mentioned_members selected recipient receives FCM', async () =>
    assert.equal(
      (await push(await message(group, { type: 'member', memberId: state.accounts[0].localId })))
        .delivered,
      1,
    ),
  );
  await checked('mentioned_members excludes unmentioned device', async () =>
    assert.equal(
      (await push(await message(group, { type: 'member', memberId: state.accounts[2].localId })))
        .delivered,
      0,
    ),
  );
  await update({ ...input, notificationPolicy: 'direct_messages_only' });
  await checked('direct_messages_only group is silent', async () =>
    assert.equal((await push(await message(group))).delivered, 0),
  );
  await checked('direct_messages_only still permits direct FCM', async () =>
    assert.equal((await push(await message(direct))).delivered, 1),
  );
  await update({ ...input, notificationPolicy: 'disabled' });
  await checked('disabled group is silent', async () =>
    assert.equal((await push(await message(group))).delivered, 0),
  );
  await update({ ...input, memberIds: [state.accounts[0].localId, state.accounts[2].localId] });
  await checked('Removed member cannot read or send', async () => {
    await call(state, 1, `/conversations/${group.id}`, undefined, { method: 'GET', expected: 403 });
    await call(
      state,
      1,
      `/conversations/${group.id}/messages`,
      {
        id: `test_${randomUUID().replaceAll('-', '')}`,
        text: 'Acesso removido',
        target: { type: 'conversation' },
        mentionedUserIds: [],
      },
      { expected: 403 },
    );
  });
  console.log(
    'Live API policy checks passed. Verify actual Android receipt separately, then run --cleanup.',
  );
} else if (phase === '--cleanup') {
  const state = JSON.parse(await readFile(statePath));
  const firestore = await googleClient('https://firestore.googleapis.com');
  const documents = `/v1/projects/${config.projectId}/databases/(default)/documents/`;
  for (const account of state.accounts) {
    const devices = await firestore.request({
      method: 'GET',
      path: `${documents}users/${account.localId}/devices`,
    });
    for (const device of devices.body.documents ?? [])
      await firestore.request({ method: 'DELETE', path: `/v1/${device.name}` });
    for (const path of [`users/${account.localId}`, `directory/${account.localId}`])
      await firestore.request({ method: 'DELETE', path: documents + path });
  }
  for (const delivery of state.deliveries)
    await firestore.request({
      method: 'DELETE',
      path: `${documents}notificationDeliveries/${delivery.conversationId}/messages/${delivery.messageId}`,
    });
  const database = await googleClient(config.databaseURL);
  for (const conversation of state.conversations) {
    await firestore.request({
      method: 'DELETE',
      path: `${documents}${conversation.type === 'group' ? 'groups' : 'directConversations'}/${conversation.id}`,
    });
    await database.request({
      method: 'DELETE',
      path: `/brisa/conversations/${conversation.id}.json`,
    });
  }
  for (const account of state.accounts) {
    const session = await authenticate('signInWithPassword', {
      email: account.email,
      password: account.password,
      returnSecureToken: true,
    });
    await authenticate('delete', { idToken: session.idToken });
  }
  await unlink(statePath);
  console.log('Removed temporary test accounts, devices, conversations and delivery records.');
} else {
  throw new Error(
    'Use --setup, --verify, or --cleanup. This script writes temporary data to the real Firebase project.',
  );
}
