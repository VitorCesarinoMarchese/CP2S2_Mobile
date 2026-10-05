import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { onValue, ref, query as databaseQuery, orderByChild, limitToLast } from 'firebase/database';
import { z } from 'zod';
import {
  conversationSchema,
  gateSchema,
  messageSchema,
  type Conversation,
  type ChatMessage,
  type Gate,
  type MessageInput,
} from '../../shared/contracts';
import { firestore, database } from './firebase';
import { apiRequest } from './api';
export function watchConversations(
  uid: string,
  next: (conversations: Conversation[]) => void,
  error: (error: unknown) => void,
) {
  let groups: Conversation[] = [];
  let directs: Conversation[] = [];
  const publish = () => next([...groups, ...directs].sort((a, b) => b.updatedAt - a.updatedAt));
  const groupListener = onSnapshot(
    query(collection(firestore, 'groups'), where('memberIds', 'array-contains', uid)),
    (snapshot) => {
      try {
        groups = snapshot.docs.map((document) => conversationSchema.parse(document.data()));
        publish();
      } catch (cause) {
        error(cause);
      }
    },
    error,
  );
  const directListener = onSnapshot(
    query(
      collection(firestore, 'directConversations'),
      where('participantIds', 'array-contains', uid),
    ),
    (snapshot) => {
      try {
        directs = snapshot.docs.map((document) => conversationSchema.parse(document.data()));
        publish();
      } catch (cause) {
        error(cause);
      }
    },
    error,
  );
  return () => {
    groupListener();
    directListener();
  };
}
export const startDirect = (participantId: string) =>
  apiRequest('/conversations/direct', conversationSchema, {
    method: 'POST',
    body: { participantId },
  });
export const getConversation = (id: string) =>
  apiRequest(`/conversations/${id}`, conversationSchema);
export const sendMessage = (id: string, body: MessageInput) =>
  apiRequest(`/conversations/${id}/messages`, messageSchema, { method: 'POST', body });
export function watchGate(id: string, next: (gate: Gate) => void, error: (error: unknown) => void) {
  return onValue(
    ref(database, `brisa/conversations/${id}/gate`),
    (snapshot) => {
      try {
        next(gateSchema.parse(snapshot.val()));
      } catch (cause) {
        error(cause);
      }
    },
    error,
  );
}
export function watchMessages(
  id: string,
  next: (messages: ChatMessage[]) => void,
  error: (error: unknown) => void,
) {
  return onValue(
    databaseQuery(
      ref(database, `brisa/conversations/${id}/messages`),
      orderByChild('createdAt'),
      limitToLast(100),
    ),
    (snapshot) => {
      try {
        const raw: unknown = snapshot.val();
        const records = raw === null ? {} : z.record(z.string(), messageSchema).parse(raw);
        next(
          Object.values(records).sort(
            (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
          ),
        );
      } catch (cause) {
        error(cause);
      }
    },
    error,
  );
}

export function watchConversation(
  id: string,
  type: 'direct' | 'group',
  next: (conversation: Conversation) => void,
  error: (cause: unknown) => void,
) {
  return onSnapshot(
    doc(firestore, type === 'group' ? 'groups' : 'directConversations', id),
    (snapshot) => {
      try {
        next(conversationSchema.parse(snapshot.data()));
      } catch (cause) {
        error(cause);
      }
    },
    error,
  );
}
