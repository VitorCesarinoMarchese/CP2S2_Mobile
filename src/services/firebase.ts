import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import config from '../../firebaseConfig.json';
export const firebaseApp = initializeApp(config);
export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const database = getDatabase(firebaseApp);
if (process.env.EXPO_PUBLIC_FIREBASE_EMULATORS === 'true') {
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? 'localhost';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(firestore, host, 8080);
  connectDatabaseEmulator(database, host, 9000);
}
