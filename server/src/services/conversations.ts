import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  conversationSchema,
  groupSchema,
  gateSchema,
  participants,
  type Conversation,
  type ChatGroup,
  type GroupInput,
} from '../../../shared/contracts';
import { database, firestore } from './firebaseAdmin';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const roomSchema = z.object({
  metadata: conversationSchema,
  gate: gateSchema,
  pending: groupSchema.optional(),
  messages: z.record(z.string(), z.unknown()).optional(),
});

export async function transactRoom(id: string, update: (raw: unknown) => unknown) {
  const reference = database.ref(`brisa/conversations/${id}`);
  await reference.once('value');
  let failure: unknown;
  const result = await reference.transaction((raw: unknown) => {
    try {
      failure = undefined;
      return update(raw);
    } catch (error) {
      failure = error;
      return undefined;
    }
  });
  if (failure) throw failure;
  return result;
}

export async function getRoom(id: string, uid: string) {
  const snapshot = await database.ref(`brisa/conversations/${id}`).get();
  if (!snapshot.exists()) throw new ApiError(404, 'Conversa não encontrada.');
  const room = roomSchema.parse(snapshot.val());
  if (!room.gate.memberIds[uid]) throw new ApiError(403, 'Você não participa desta conversa.');
  return room;
}
export async function getConversation(id: string, uid: string): Promise<Conversation> {
  const room = await getRoom(id, uid);
  if (room.gate.phase !== 'ready')
    throw new ApiError(409, 'O grupo está atualizando. Tente novamente em instantes.');
  return room.metadata;
}
function membership(ids: string[]): Record<string, true> {
  return Object.fromEntries(ids.map((uid) => [uid, true]));
}
async function persistMetadata(next: Conversation) {
  const collection = next.type === 'group' ? 'groups' : 'directConversations';
  await firestore.runTransaction(async (transaction) => {
    const reference = firestore.doc(`${collection}/${next.id}`);
    const snapshot = await transaction.get(reference);
    if (next.type === 'group' && snapshot.exists) {
      const old = groupSchema.parse(snapshot.data());
      if (old.version > next.version) throw new ApiError(409, 'A versão do grupo mudou.');
      if (old.version === next.version) return;
      if (old.memberIds.length > next.memberLimit && next.memberIds.length > next.memberLimit)
        throw new ApiError(400, 'O grupo não possui vagas.');
    }
    if (
      next.type === 'group' &&
      (next.memberIds.length > next.memberLimit || !next.memberIds.includes(next.ownerId))
    )
      throw new ApiError(400, 'Limite ou proprietário inválido.');
    transaction.set(reference, next);
  });
}
export async function recoverGroup(id: string, uid: string): Promise<ChatGroup> {
  const room = await getRoom(id, uid);
  if (room.metadata.type !== 'group' || room.metadata.ownerId !== uid)
    throw new ApiError(403, 'Somente o proprietário pode gerenciar o grupo.');
  if (room.gate.phase === 'ready') return room.metadata;
  if (!room.pending) throw new ApiError(409, 'Atualização incompleta. Contate a equipe.');
  const pending = room.pending;
  await persistMetadata(pending);
  const result = await transactRoom(id, (raw: unknown) => {
    if (raw === null) return null;
    const current = roomSchema.parse(raw);
    if (current.gate.operationId !== room.gate.operationId || current.gate.phase !== 'changing')
      return;
    return {
      ...current,
      metadata: pending,
      pending: null,
      gate: {
        phase: 'ready',
        operationId: room.gate.operationId,
        memberIds: membership(pending.memberIds),
      },
    };
  });
  if (!result.committed) {
    const current = await getRoom(id, uid);
    if (
      current.metadata.type === 'group' &&
      current.metadata.version === pending.version &&
      current.gate.phase === 'ready'
    )
      return current.metadata;
    throw new ApiError(409, 'Outra atualização está em andamento.');
  }
  return pending;
}
export async function changeGroup(
  id: string,
  uid: string,
  input: GroupInput,
  creating: boolean,
  expectedVersion?: number,
): Promise<ChatGroup> {
  if (!input.memberIds.includes(uid))
    throw new ApiError(400, 'O proprietário deve permanecer no grupo.');
  const users = await firestore.getAll(
    ...input.memberIds.map((member) => firestore.doc(`users/${member}`)),
  );
  if (users.some((user) => !user.exists))
    throw new ApiError(400, 'Um integrante não possui cadastro completo.');
  const operationId = randomUUID();
  const result = await transactRoom(id, (raw: unknown) => {
    if (raw === null) {
      if (!creating) return null;
      const next: ChatGroup = {
        ...input,
        id,
        type: 'group',
        ownerId: uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      return {
        metadata: next,
        pending: next,
        gate: { phase: 'changing', operationId, memberIds: membership(next.memberIds) },
      };
    }
    const room = roomSchema.parse(raw);
    if (room.metadata.type !== 'group' || room.metadata.ownerId !== uid)
      throw new ApiError(403, 'Somente o proprietário pode gerenciar o grupo.');
    if (expectedVersion !== room.metadata.version)
      throw new ApiError(409, 'O grupo mudou. Reabra a edição para usar a versão mais recente.');
    if (creating || room.gate.phase !== 'ready')
      throw new ApiError(409, 'O grupo já existe ou precisa concluir uma atualização.');
    const next: ChatGroup = {
      ...room.metadata,
      ...input,
      updatedAt: Date.now(),
      version: room.metadata.version + 1,
    };
    return { ...room, pending: next, gate: { ...room.gate, phase: 'changing', operationId } };
  });
  if (!result.committed) throw new ApiError(409, 'Não foi possível atualizar o grupo.');
  if (!result.snapshot.exists()) throw new ApiError(404, 'Grupo não encontrado.');
  return recoverGroup(id, uid);
}
export async function persistDirect(conversation: Conversation) {
  const result = await transactRoom(
    conversation.id,
    (raw: unknown) =>
      raw ?? {
        metadata: conversation,
        gate: {
          phase: 'ready',
          operationId: '',
          memberIds: membership(participants(conversation)),
        },
      },
  );
  const actual = roomSchema.parse(result.snapshot.val()).metadata;
  if (
    actual.type !== 'direct' ||
    conversation.type !== 'direct' ||
    actual.participantIds.join('|') !== conversation.participantIds.join('|')
  )
    throw new ApiError(409, 'Identificador de conversa incompatível.');
  await persistMetadata(actual);
  return actual;
}
