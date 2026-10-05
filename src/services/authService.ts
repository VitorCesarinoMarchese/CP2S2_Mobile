import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase';
export const observeAuth = (listener: Parameters<typeof onAuthStateChanged>[1]) =>
  onAuthStateChanged(auth, listener);
export const login = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password);
export const createAccount = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email.trim(), password);
export const logout = () => signOut(auth);
