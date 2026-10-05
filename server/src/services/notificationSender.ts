import { z } from 'zod';
import {
  conversationSchema,
  idSchema,
  deviceSchema,
  messageSchema,
  participants,
  resolveRecipients,
} from '../../../shared/contracts';
import { database, firestore, messaging } from './firebaseAdmin';
import { ApiError, getConversation } from './conversations';
export async function notifyMessage(conversationId: string, messageId: string, uid: string) {
  const message = messageSchema.parse(
    (await database.ref(`brisa/conversations/${conversationId}/messages/${messageId}`).get()).val(),
  );
  if (message.senderId !== uid || message.conversationId !== conversationId)
    throw new ApiError(403, 'Você não pode notificar esta mensagem.');
  const live = await getConversation(conversationId, uid);
  const conversation = conversationSchema.parse(
    (
      await firestore
        .doc(`${live.type === 'group' ? 'groups' : 'directConversations'}/${conversationId}`)
        .get()
    ).data(),
  );
  if (
    conversation.type !== live.type ||
    (conversation.type === 'group' &&
      live.type === 'group' &&
      conversation.version !== live.version)
  )
    throw new ApiError(409, 'Aguarde a sincronização do grupo.');
  if (!participants(conversation).includes(uid))
    throw new ApiError(403, 'Você não participa desta conversa.');
  if (message.conversationType !== conversation.type)
    throw new ApiError(400, 'Tipo de conversa inválido.');
  const delivery = firestore.doc(`notificationDeliveries/${conversationId}/messages/${messageId}`);
  const claimed = await firestore.runTransaction(async (transaction) => {
    if ((await transaction.get(delivery)).exists) return false;
    transaction.create(delivery, { state: 'claimed', createdAt: Date.now(), senderId: uid });
    return true;
  });
  if (!claimed) return { status: 'duplicate' };
  try {
    const recipients = resolveRecipients(conversation, message);
    const registrations: { token: string; path: string; uid: string }[] = [];
    for (const recipient of recipients) {
      const devices = await firestore
        .collection(`users/${recipient}/devices`)
        .where('enabled', '==', true)
        .get();
      for (const document of devices.docs) {
        const device = deviceSchema.safeParse(document.data());
        if (device.success)
          registrations.push({ token: device.data.token, path: document.ref.path, uid: recipient });
      }
    }
    const tokens = [...new Set(registrations.map((device) => device.token))];
    let delivered = 0;
    for (let index = 0; index < tokens.length; index += 500) {
      const current = await getConversation(conversationId, uid);
      const permitted = new Set(resolveRecipients(current, message));
      const batch = tokens
        .slice(index, index + 500)
        .filter((token) =>
          registrations.some((device) => device.token === token && permitted.has(device.uid)),
        );
      if (batch.length === 0) continue;
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: 'Brisa', body: 'Você recebeu uma nova mensagem.' },
        data: { conversationId, conversationType: conversation.type, messageId },
        android: { priority: 'high', notification: { channelId: 'messages', tag: messageId } },
        apns: {
          headers: { 'apns-collapse-id': messageId },
          payload: { aps: { sound: 'default' } },
        },
      });
      delivered += result.successCount;
      await Promise.all(
        result.responses.map(async (response, position) => {
          if (
            response.error?.code === 'messaging/registration-token-not-registered' ||
            response.error?.code === 'messaging/invalid-registration-token'
          ) {
            const token = batch[position];
            await Promise.all(
              registrations
                .filter((device) => device.token === token)
                .map((device) => firestore.doc(device.path).update({ enabled: false })),
            );
          }
        }),
      );
    }
    await delivery.update({ state: 'sent', delivered, finishedAt: Date.now() });
    return { status: 'sent', delivered };
  } catch (error) {
    await delivery.update({ state: 'failed_or_uncertain', finishedAt: Date.now() });
    throw error;
  }
}
export const notificationRequestSchema = z.object({
  conversationId: idSchema,
  messageId: idSchema,
});
