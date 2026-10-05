import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { z } from 'zod';
import {
  publicUserSchema,
  userSchema,
  type ChatUser,
  type PublicUser,
} from '../../shared/contracts';
import { firestore } from './firebase';
import { apiRequest } from './api';
export function watchUsers(next: (users: PublicUser[]) => void, error: (error: unknown) => void) {
  return onSnapshot(
    query(collection(firestore, 'directory'), orderBy('name')),
    (snapshot) => {
      try {
        next(snapshot.docs.map((document) => publicUserSchema.parse(document.data())));
      } catch (cause) {
        error(cause);
      }
    },
    error,
  );
}
export const getProfile = (uid: string) => apiRequest(`/users/${uid}`, userSchema);
export const saveProfile = (profile: Omit<ChatUser, 'uid' | 'email' | 'createdAt'>) =>
  apiRequest('/users/me', userSchema, { method: 'PUT', body: profile });
