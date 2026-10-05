import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  directId,
  groupInputSchema,
  messageSchema,
  profileInputSchema,
  resolveRecipients,
  type ChatGroup,
  type ChatMessage,
  type DirectConversation,
  type NotificationPolicy,
} from '../shared/contracts';
const group: ChatGroup = {
  id: 'group_1',
  type: 'group',
  name: 'Turma',
  photoUrl: '',
  ownerId: 'a',
  memberIds: ['a', 'b', 'c'],
  memberLimit: 3,
  notificationPolicy: 'all_group_messages',
  createdAt: 1,
  updatedAt: 1,
  version: 1,
};
const message: ChatMessage = {
  id: 'm1',
  conversationId: group.id,
  conversationType: 'group',
  senderId: 'a',
  text: 'Olá',
  target: { type: 'conversation' },
  mentionedUserIds: [],
  createdAt: 1,
};
test('direct ID is symmetric, unambiguous, and rejects self-chat', () => {
  assert.equal(directId('a', 'b'), directId('b', 'a'));
  assert.notEqual(directId('a_b', 'c'), directId('a', 'b_c'));
  assert.throws(() => directId('a', 'a'));
});
test('group schema rejects overflow, fractional limits and duplicate members', () => {
  assert.equal(groupInputSchema.safeParse({ ...group, memberLimit: 2 }).success, false);
  assert.equal(groupInputSchema.safeParse({ ...group, memberLimit: 3.5 }).success, false);
  assert.equal(groupInputSchema.safeParse({ ...group, memberIds: ['a', 'a'] }).success, false);
});
test('all notification policies filter sender and outsiders', () => {
  const cases: [NotificationPolicy, string[]][] = [
    ['all_group_messages', ['b', 'c']],
    ['mentioned_members', []],
    ['direct_messages_only', []],
    ['disabled', []],
  ];
  for (const [policy, expected] of cases)
    assert.deepEqual(
      resolveRecipients({ ...group, notificationPolicy: policy }, message),
      expected,
    );
  assert.deepEqual(
    resolveRecipients(
      { ...group, notificationPolicy: 'mentioned_members' },
      { ...message, mentionedUserIds: ['a', 'b', 'outsider'] },
    ),
    ['b'],
  );
  assert.deepEqual(
    resolveRecipients(group, { ...message, target: { type: 'member', memberId: 'c' } }),
    ['c'],
  );
});
test('direct push targets the other participant and honors disabled', () => {
  const direct: DirectConversation = {
    id: 'direct',
    type: 'direct',
    participantIds: ['a', 'b'],
    notificationPolicy: 'all_group_messages',
    createdAt: 1,
    updatedAt: 1,
  };
  assert.deepEqual(resolveRecipients(direct, { ...message, conversationType: 'direct' }), ['b']);
  assert.deepEqual(resolveRecipients({ ...direct, notificationPolicy: 'disabled' }, message), []);
});
test('external messages and dates are validated', () => {
  assert.equal(messageSchema.safeParse({ ...message, text: '   ' }).success, false);
  const profile = { name: 'Brisa', phoneNumber: '11999999999', photoUrl: '' };
  assert.equal(
    profileInputSchema.safeParse({ ...profile, birthDate: '2000-02-30' }).success,
    false,
  );
  assert.equal(profileInputSchema.safeParse({ ...profile, birthDate: '2000-02-29' }).success, true);
});
