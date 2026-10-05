import 'dotenv/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
const projectId = process.env.FIREBASE_PROJECT_ID;
const databaseURL = process.env.FIREBASE_DATABASE_URL;
if (!projectId || !databaseURL)
  throw new Error('Configure FIREBASE_PROJECT_ID e FIREBASE_DATABASE_URL.');
const emulators = process.env.FIREBASE_EMULATORS === 'true';
if (!emulators && (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY))
  throw new Error('Configure as credenciais Admin nos segredos da hospedagem.');
if (
  !emulators &&
  (process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_DATABASE_EMULATOR_HOST)
)
  throw new Error('Emuladores proibidos no servidor de produção.');
initializeApp({
  projectId,
  databaseURL,
  ...(emulators
    ? {}
    : {
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      }),
});
export const adminAuth = getAuth();
export const firestore = getFirestore();
export const database = getDatabase();
export const messaging = getMessaging();
