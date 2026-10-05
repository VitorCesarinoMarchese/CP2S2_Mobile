import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, onValue, ref, set } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { groupSchema, messageSchema, userSchema, type ChatGroup } from '../../shared/contracts';
let environment: RulesTestEnvironment;
let server: Server;
let base: string;
const accounts: { uid: string; token: string }[] = [];
async function request(path: string, uidIndex: number, method = 'GET', body?: unknown) {
  const account = accounts[uidIndex];
  if (!account) throw new Error('Test account missing');
  return fetch(`${base}${path}`, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
before(async () => {
  process.env.FIREBASE_PROJECT_ID = 'demo-brisa';
  process.env.FIREBASE_DATABASE_URL = 'https://demo-brisa.firebaseio.com';
  process.env.FIREBASE_EMULATORS = 'true';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
  environment = await initializeTestEnvironment({
    projectId: 'demo-brisa',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
    database: { host: '127.0.0.1', port: 9000, rules: readFileSync('database.rules.json', 'utf8') },
  });
  await environment.clearFirestore();
  await environment.clearDatabase();
  const { app } = await import('../../server/src/app');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server missing');
  base = `http://127.0.0.1:${address.port}`;
  const signup = z.object({ localId: z.string(), idToken: z.string() });
  for (let index = 0; index < 5; index++) {
    const response = await fetch(
      'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `user${index}-${Date.now()}@example.test`,
          password: 'test-password',
          returnSecureToken: true,
        }),
      },
    );
    const account = signup.parse(await response.json());
    accounts.push({ uid: account.localId, token: account.idToken });
    const profile = await request('/users/me', index, 'PUT', {
      name: `Pessoa ${index}`,
      phoneNumber: '11999999999',
      birthDate: '2000-01-01',
      photoUrl: '',
    });
    assert.equal(profile.status, 200);
  }
});
after(async () => {
  await environment?.cleanup();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  const { getApps, deleteApp } = await import('firebase-admin/app');
  await Promise.all(getApps().map(deleteApp));
});
function uid(index: number): string {
  const account = accounts[index];
  if (!account) throw new Error('missing');
  return account.uid;
}
function context(index: number) {
  return environment.authenticatedContext(uid(index), {
    firebase: { sign_in_provider: 'password' },
  });
}
let group: ChatGroup;
test('API requires Firebase password auth and denies unrelated profiles', async () => {
  assert.equal((await fetch(`${base}/users/${uid(0)}`)).status, 401);
  assert.equal((await request(`/users/${uid(1)}`, 0)).status, 403);
  assert.equal((await request('/health', 0)).status, 200);
});
test('group membership creates both databases; concurrent edits do not exceed limit', async () => {
  const input = {
    name: 'Turma',
    photoUrl: '',
    memberIds: [uid(0), uid(1)],
    memberLimit: 3,
    notificationPolicy: 'all_group_messages',
  };
  assert.equal(
    (await request('/groups', 0, 'POST', { id: 'direct_reserved', group: input })).status,
    400,
  );
  const created = await request('/groups', 0, 'POST', { id: 'group_test', group: input });
  assert.equal(created.status, 201, await created.clone().text());
  group = groupSchema.parse(await created.json());
  const updates = await Promise.all(
    [2, 3].map((index) =>
      request('/groups/group_test', 0, 'PUT', {
        group: { ...input, memberIds: [...input.memberIds, uid(index)] },
        expectedVersion: 1,
      }),
    ),
  );
  assert.deepEqual(updates.map((response) => response.status).sort(), [200, 409]);
  const room = await request('/conversations/group_test', 0);
  group = groupSchema.parse(await room.json());
  assert.equal(group.memberIds.length, 3);
  assert.equal(
    (
      await request('/groups/group_test', 0, 'PUT', {
        group: { ...group, memberIds: [...group.memberIds, uid(4)] },
        expectedVersion: group.version,
      })
    ).status,
    400,
  );
  assert.equal(
    (await request('/groups/group_test', 1, 'PUT', { group, expectedVersion: group.version }))
      .status,
    403,
  );
});
test('messages persist once, live RTDB reads are protected, push requests are deduplicated', async () => {
  const message = {
    id: 'message_1',
    text: 'Olá, turma!',
    target: { type: 'conversation' },
    mentionedUserIds: [],
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request('/conversations/group_test/messages', 0, 'POST', message);
    assert.equal(response.status, 200);
    messageSchema.parse(await response.json());
  }
  const response = await request('/notifications/messages', 0, 'POST', {
    conversationId: 'group_test',
    messageId: 'message_1',
  });
  assert.equal(response.status, 200);
  assert.equal(z.object({ status: z.string() }).parse(await response.json()).status, 'sent');
  const duplicate = await request('/notifications/messages', 0, 'POST', {
    conversationId: 'group_test',
    messageId: 'message_1',
  });
  assert.equal(z.object({ status: z.string() }).parse(await duplicate.json()).status, 'duplicate');
  const permitted = context(1).database();
  const snapshot = await assertSucceeds(
    get(ref(permitted, 'brisa/conversations/group_test/messages')),
  );
  assert.equal(snapshot.size, 1);
  await assertFails(get(ref(context(4).database(), 'brisa/conversations/group_test/messages')));
  await assertFails(set(ref(permitted, 'brisa/conversations/group_test/messages/forged'), message));
  assert.equal(
    (await request('/conversations/group_test/messages', 4, 'POST', { ...message, id: 'outsider' }))
      .status,
    403,
  );
  assert.equal(
    (
      await request('/notifications/messages', 1, 'POST', {
        conversationId: 'group_test',
        messageId: 'message_1',
      })
    ).status,
    403,
  );
});
test('private profiles and device tokens are protected; shared profile API works', async () => {
  userSchema.parse(await (await request(`/users/${uid(1)}`, 0)).json());
  await assertFails(getDoc(doc(context(0).firestore(), 'users', uid(1))));
  await assertSucceeds(getDoc(doc(context(0).firestore(), 'directory', uid(1))));
  await assertFails(getDoc(doc(context(0).firestore(), 'users', uid(0), 'devices', 'device')));
  await assertFails(
    setDoc(doc(context(0).firestore(), 'groups', 'group_test'), {
      memberIds: [uid(0)],
      memberLimit: 100,
    }),
  );
  await assertFails(
    getDoc(doc(environment.unauthenticatedContext().firestore(), 'directory', uid(0))),
  );
});
test('removed member immediately loses message and profile access', async () => {
  const response = await request('/groups/group_test', 0, 'PUT', {
    group: { ...group, memberIds: group.memberIds.filter((member) => member !== uid(1)) },
    expectedVersion: group.version,
  });
  assert.equal(response.status, 200);
  group = groupSchema.parse(await response.json());
  await assertFails(get(ref(context(1).database(), 'brisa/conversations/group_test/messages')));
  assert.equal(
    (
      await request('/conversations/group_test/messages', 1, 'POST', {
        id: 'removed_send',
        text: 'blocked',
        target: { type: 'conversation' },
        mentionedUserIds: [],
      })
    ).status,
    403,
  );
  assert.equal((await request(`/users/${uid(0)}`, 1)).status, 403);
});
test('interrupted group synchronization blocks reads and can be recovered idempotently', async () => {
  const next = {
    ...group,
    name: 'Turma recuperada',
    version: group.version + 1,
    updatedAt: Date.now(),
  };
  await environment.withSecurityRulesDisabled(async (admin) => {
    const roomRef = ref(admin.database(), 'brisa/conversations/group_test');
    const room: unknown = (await get(roomRef)).val();
    const parsed = z
      .object({
        metadata: groupSchema,
        gate: z.object({ memberIds: z.record(z.string(), z.literal(true)) }),
        messages: z.unknown().optional(),
      })
      .parse(room);
    await set(roomRef, {
      ...parsed,
      pending: next,
      gate: { ...parsed.gate, phase: 'changing', operationId: 'interrupted_test' },
    });
  });
  await assertFails(get(ref(context(0).database(), 'brisa/conversations/group_test/messages')));
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request('/groups/group_test/reconcile', 0, 'POST');
    assert.equal(response.status, 200);
    assert.equal(groupSchema.parse(await response.json()).version, next.version);
  }
  await assertSucceeds(get(ref(context(0).database(), 'brisa/conversations/group_test/messages')));
});
test('same pair creates a single direct conversation and self-chat is blocked', async () => {
  const first = await request('/conversations/direct', 0, 'POST', { participantId: uid(1) });
  const second = await request('/conversations/direct', 1, 'POST', { participantId: uid(0) });
  const schema = z.object({ id: z.string() });
  assert.equal(schema.parse(await first.json()).id, schema.parse(await second.json()).id);
  assert.equal(
    (await request('/conversations/direct', 0, 'POST', { participantId: uid(0) })).status,
    400,
  );
});
