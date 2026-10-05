import { z } from 'zod';
export const uidSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export const idSchema = z
  .string()
  .min(1)
  .max(280)
  .regex(/^[A-Za-z0-9_-]+$/);
export const policySchema = z.enum([
  'all_group_messages',
  'mentioned_members',
  'direct_messages_only',
  'disabled',
]);
export type NotificationPolicy = z.infer<typeof policySchema>;
const photoSchema = z
  .string()
  .max(2048)
  .refine((value) => value === '' || value.startsWith('https://'), 'Use uma URL HTTPS.');
export const profileInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{8,22}$/, 'Informe um celular válido.'),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.')
    .refine((value) => {
      const date = new Date(`${value}T12:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value &&
        value <= new Date().toISOString().slice(0, 10) &&
        value >= '1900-01-01'
      );
    }, 'Informe uma data de nascimento válida.'),
  photoUrl: photoSchema,
});
export const userSchema = profileInputSchema.extend({
  uid: uidSchema,
  email: z.email(),
  createdAt: z.number(),
});
export type ChatUser = z.infer<typeof userSchema>;
export const publicUserSchema = userSchema.pick({ uid: true, name: true, photoUrl: true });
export type PublicUser = z.infer<typeof publicUserSchema>;
export const groupInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    photoUrl: photoSchema,
    memberIds: z
      .array(uidSchema)
      .min(2)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, 'Integrantes repetidos.'),
    memberLimit: z.number().int().min(2).max(100),
    notificationPolicy: policySchema,
  })
  .refine(
    (group) => group.memberIds.length <= group.memberLimit,
    'O limite não pode ser menor que o número de integrantes.',
  );
export type GroupInput = z.infer<typeof groupInputSchema>;
export const groupSchema = groupInputSchema.extend({
  id: idSchema,
  type: z.literal('group'),
  ownerId: uidSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number().int(),
});
export type ChatGroup = z.infer<typeof groupSchema>;
export const directSchema = z.object({
  id: idSchema,
  type: z.literal('direct'),
  participantIds: z.tuple([uidSchema, uidSchema]),
  createdAt: z.number(),
  updatedAt: z.number(),
  notificationPolicy: z.enum(['all_group_messages', 'disabled']).default('all_group_messages'),
});
export type DirectConversation = z.infer<typeof directSchema>;
export const conversationSchema = z.discriminatedUnion('type', [groupSchema, directSchema]);
export type Conversation = z.infer<typeof conversationSchema>;
export const messageTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('conversation') }),
  z.object({ type: z.literal('member'), memberId: uidSchema }),
]);
export const messageInputSchema = z.object({
  id: idSchema,
  text: z.string().trim().min(1).max(4000),
  target: messageTargetSchema,
  mentionedUserIds: z.array(uidSchema).max(100).default([]),
});
export const messageSchema = messageInputSchema.extend({
  conversationId: idSchema,
  conversationType: z.enum(['direct', 'group']),
  senderId: uidSchema,
  createdAt: z.number(),
});
export type ChatMessage = z.infer<typeof messageSchema>;
export type MessageInput = z.infer<typeof messageInputSchema>;
export const deviceSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['android', 'ios']),
  enabled: z.boolean(),
  updatedAt: z.number(),
});
export const gateSchema = z.object({
  phase: z.enum(['ready', 'changing']),
  operationId: z.string(),
  memberIds: z.record(z.string(), z.literal(true)),
});
export type Gate = z.infer<typeof gateSchema>;
export function participants(conversation: Conversation): string[] {
  return conversation.type === 'group' ? conversation.memberIds : conversation.participantIds;
}
export function directId(first: string, second: string): string {
  if (first === second) throw new Error('Você não pode conversar consigo mesmo.');
  return `direct_${[first, second]
    .sort()
    .map((uid) => `${uid.length}_${uid}`)
    .join('_')}`;
}
export function resolveRecipients(conversation: Conversation, message: ChatMessage): string[] {
  const members = participants(conversation).filter((uid) => uid !== message.senderId);
  if (conversation.notificationPolicy === 'disabled') return [];
  if (conversation.type === 'direct') return members;
  if (conversation.notificationPolicy === 'direct_messages_only') return [];
  const selected = new Set([
    ...message.mentionedUserIds,
    ...(message.target.type === 'member' ? [message.target.memberId] : []),
  ]);
  if (conversation.notificationPolicy === 'mentioned_members' || message.target.type === 'member')
    return members.filter((uid) => selected.has(uid));
  return members;
}
