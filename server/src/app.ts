import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z, ZodError } from 'zod';
import {
  conversationSchema,
  deviceSchema,
  directId,
  groupInputSchema,
  idSchema,
  messageInputSchema,
  messageSchema,
  participants,
  photoUploadInputSchema,
  profileInputSchema,
  uidSchema,
  userSchema,
} from '../../shared/contracts';
import { authenticate } from './middleware/authenticate';
import { adminAuth, database, firestore } from './services/firebaseAdmin';
import {
  ApiError,
  changeGroup,
  getConversation,
  getRoom,
  persistDirect,
  recoverGroup,
  roomSchema,
  transactRoom,
} from './services/conversations';
import { notificationRequestSchema, notifyMessage } from './services/notificationSender';
import { authorizePhotoUpload } from './services/photoStorage';
export const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean) }));
app.use(express.json({ limit: '32kb' }));
app.get('/health', async (_request, response, next) => {
  try {
    await Promise.all([firestore.doc('_health/connectivity').get(), database.ref('_health').get()]);
    response.json({ status: 'ok', service: 'brisa-api', firebase: 'reachable' });
  } catch (error) {
    next(new ApiError(503, 'Firebase indisponível.'));
  }
});
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Aguarde um minuto.' },
  }),
);
app.use(authenticate);
function caller(value: unknown): string {
  return uidSchema.parse(value);
}
app.post('/photos/uploads', async (request, response) => {
  response.json(
    await authorizePhotoUpload(
      caller(response.locals.uid),
      photoUploadInputSchema.parse(request.body),
    ),
  );
});
app.put('/users/me', async (request, response) => {
  const uid = caller(response.locals.uid);
  const input = profileInputSchema.parse(request.body);
  const account = await adminAuth.getUser(uid);
  if (!account.email) throw new ApiError(400, 'A conta não possui e-mail.');
  const reference = firestore.doc(`users/${uid}`);
  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    const old = existing.exists ? userSchema.parse(existing.data()) : null;
    const user = { ...input, uid, email: account.email, createdAt: old?.createdAt ?? Date.now() };
    transaction.set(reference, user);
    transaction.set(firestore.doc(`directory/${uid}`), {
      uid,
      name: input.name,
      photoUrl: input.photoUrl,
    });
  });
  response.json(userSchema.parse((await reference.get()).data()));
});
app.get('/users/:uid', async (request, response) => {
  const uid = caller(response.locals.uid);
  const target = uidSchema.parse(request.params.uid);
  if (uid !== target) {
    const [directs, groups] = await Promise.all([
      firestore
        .collection('directConversations')
        .where('participantIds', 'array-contains', uid)
        .get(),
      firestore.collection('groups').where('memberIds', 'array-contains', uid).get(),
    ]);
    let permitted = false;
    for (const document of [...directs.docs, ...groups.docs]) {
      const candidate = conversationSchema.parse(document.data());
      if (!participants(candidate).includes(target)) continue;
      try {
        const actual = await getConversation(candidate.id, uid);
        if (participants(actual).includes(target)) {
          permitted = true;
          break;
        }
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }
    }
    if (!permitted)
      throw new ApiError(403, 'O perfil fica disponível após vocês compartilharem uma conversa.');
  }
  const profile = await firestore.doc(`users/${target}`).get();
  if (!profile.exists) throw new ApiError(404, 'Este usuário ainda não concluiu o cadastro.');
  response.json(userSchema.parse(profile.data()));
});
app.post('/conversations/direct', async (request, response) => {
  const uid = caller(response.locals.uid);
  const { participantId } = z.object({ participantId: uidSchema }).parse(request.body);
  if (participantId === uid) throw new ApiError(400, 'Você não pode conversar consigo mesmo.');
  const profiles = await firestore.getAll(
    firestore.doc(`users/${uid}`),
    firestore.doc(`users/${participantId}`),
  );
  if (profiles.some((profile) => !profile.exists))
    throw new ApiError(400, 'Conclua o cadastro antes de conversar.');
  const sorted = [uid, participantId].sort();
  const first = sorted[0];
  const second = sorted[1];
  if (!first || !second) throw new ApiError(400, 'Participantes inválidos.');
  const conversation = await persistDirect({
    id: directId(uid, participantId),
    type: 'direct',
    participantIds: [first, second],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    notificationPolicy: 'all_group_messages',
  });
  response.json(conversation);
});
app.get('/conversations/:id', async (request, response) => {
  response.json(
    await getConversation(idSchema.parse(request.params.id), caller(response.locals.uid)),
  );
});
app.post('/groups', async (request, response) => {
  const { id, group } = z
    .object({
      id: idSchema.refine((id) => id.startsWith('group_'), 'Identificador de grupo inválido.'),
      group: groupInputSchema,
    })
    .parse(request.body);
  response.status(201).json(await changeGroup(id, caller(response.locals.uid), group, true));
});
app.put('/groups/:id', async (request, response) => {
  const input = z
    .object({ group: groupInputSchema, expectedVersion: z.number().int().min(1) })
    .parse(request.body);
  response.json(
    await changeGroup(
      idSchema.parse(request.params.id),
      caller(response.locals.uid),
      input.group,
      false,
      input.expectedVersion,
    ),
  );
});
app.post('/groups/:id/reconcile', async (request, response) => {
  response.json(await recoverGroup(idSchema.parse(request.params.id), caller(response.locals.uid)));
});
app.post('/conversations/:id/messages', async (request, response) => {
  const uid = caller(response.locals.uid);
  const id = idSchema.parse(request.params.id);
  const input = messageInputSchema.parse(request.body);
  let failure: ApiError | null = null;
  const result = await transactRoom(id, (raw: unknown) => {
    if (raw === null) return null;
    failure = null;
    const room = roomSchema.parse(raw);
    if (room.gate.phase !== 'ready' || !room.gate.memberIds[uid]) {
      failure = new ApiError(403, 'Você não tem acesso a esta conversa.');
      return;
    }
    const mentioned = [
      ...input.mentionedUserIds,
      ...(input.target.type === 'member' ? [input.target.memberId] : []),
    ];
    if (
      mentioned.some((member) => !room.gate.memberIds[member]) ||
      (room.metadata.type === 'direct' && mentioned.length > 0)
    ) {
      failure = new ApiError(400, 'Selecione somente integrantes ativos do grupo.');
      return;
    }
    const existing = room.messages?.[input.id];
    if (existing) {
      const prior = messageSchema.parse(existing);
      if (
        prior.senderId !== uid ||
        prior.text !== input.text ||
        JSON.stringify(prior.target) !== JSON.stringify(input.target) ||
        JSON.stringify(prior.mentionedUserIds) !== JSON.stringify(input.mentionedUserIds)
      ) {
        failure = new ApiError(409, 'Este identificador já pertence a outra mensagem.');
        return;
      }
      return raw;
    }
    const message = {
      ...input,
      conversationId: id,
      conversationType: room.metadata.type,
      senderId: uid,
      createdAt: Date.now(),
    };
    return { ...room, messages: { ...room.messages, [input.id]: message } };
  });
  if (!result.committed)
    throw failure ?? new ApiError(409, 'Não foi possível enviar a mensagem. Tente novamente.');
  if (!result.snapshot.exists()) throw new ApiError(404, 'Conversa não encontrada.');
  const room = roomSchema.parse(result.snapshot.val());
  response.json(messageSchema.parse(room.messages?.[input.id]));
});
app.post('/notifications/messages', async (request, response) => {
  const { conversationId, messageId } = notificationRequestSchema.parse(request.body);
  response.json(await notifyMessage(conversationId, messageId, caller(response.locals.uid)));
});
app.put('/devices/:id', async (request, response) => {
  const uid = caller(response.locals.uid);
  const id = idSchema.parse(request.params.id);
  const input = deviceSchema.omit({ updatedAt: true }).parse(request.body);
  await firestore.doc(`users/${uid}/devices/${id}`).set({ ...input, updatedAt: Date.now() });
  response.status(204).end();
});
app.delete('/devices/:id', async (request, response) => {
  await firestore
    .doc(`users/${caller(response.locals.uid)}/devices/${idSchema.parse(request.params.id)}`)
    .delete();
  response.status(204).end();
});
app.use((_request, response) => {
  response.status(404).json({ error: 'Endpoint não encontrado.' });
});
const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({ error: error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }
  console.error(
    JSON.stringify({
      event: 'request_failed',
      kind: error instanceof Error ? error.name : 'unknown',
    }),
  );
  response
    .status(500)
    .json({ error: 'O serviço está indisponível. Tente novamente em instantes.' });
};
app.use(errorHandler);
if (require.main === module)
  app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0', () => {
    console.info('Brisa API pronta.');
  });
