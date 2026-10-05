import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { userSchema, type ChatUser } from '../../shared/contracts';
import { observeAuth, logout } from '../services/authService';
import { unregisterDevice } from '../services/notificationService';
import { firestore } from '../services/firebase';
import { readableError } from '../utils/errors';
type AuthValue = {
  user: User | null;
  profile: ChatUser | null;
  loading: boolean;
  error: string;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(
    () =>
      observeAuth((account) => {
        setUser(account);
        setProfile(null);
        setError('');
        setLoading(Boolean(account));
      }),
    [],
  );
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(firestore, 'users', user.uid),
      (snapshot) => {
        try {
          setProfile(snapshot.exists() ? userSchema.parse(snapshot.data()) : null);
          setLoading(false);
        } catch (cause) {
          setError(readableError(cause));
          setLoading(false);
        }
      },
      (cause) => {
        setError(readableError(cause));
        setLoading(false);
      },
    );
  }, [user]);
  const signOut = useCallback(async () => {
    try {
      await unregisterDevice();
    } finally {
      await logout();
      setProfile(null);
      setUser(null);
    }
  }, []);
  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider ausente.');
  return value;
}
