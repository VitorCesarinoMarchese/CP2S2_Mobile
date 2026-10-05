import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Conversation, PublicUser } from '../../shared/contracts';
import { useAuth } from '../contexts/AuthContext';
import { watchConversations } from '../services/chatService';
import { watchUsers } from '../services/userService';
import { readableError } from '../utils/errors';
export function useConversations() {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setConversations([]);
    setError('');
    setLoading(true);
    if (!user) return;
    return watchConversations(
      user.uid,
      (values) => {
        setConversations(values);
        setLoading(false);
      },
      (cause) => {
        setError(readableError(cause));
        setLoading(false);
      },
    );
  }, [user, attempt]);
  return { conversations, loading, error, reload };
}
export function useUsers(search = '') {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setUsers([]);
    setError('');
    setLoading(true);
    if (!user) return;
    return watchUsers(
      (values) => {
        setUsers(values);
        setLoading(false);
      },
      (cause) => {
        setError(readableError(cause));
        setLoading(false);
      },
    );
  }, [user, attempt]);
  const filtered = useMemo(
    () =>
      users.filter(
        (profile) =>
          profile.uid !== user?.uid &&
          profile.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
      ),
    [users, user?.uid, search],
  );
  return { users, filtered, loading, error, reload };
}
