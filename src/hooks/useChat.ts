import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '../../shared/contracts';
import { useAuth } from '../contexts/AuthContext';
import { watchGate, watchMessages } from '../services/chatService';
import { readableError } from '../utils/errors';
export function useChat(id: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const reload = useCallback(() => setRetry((value) => value + 1), []);
  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setError('');
    if (!user) return;
    let removeMessages: (() => void) | undefined;
    const fail = (cause: unknown) => {
      setMessages([]);
      setError(readableError(cause));
      setLoading(false);
    };
    const removeGate = watchGate(
      id,
      (gate) => {
        removeMessages?.();
        removeMessages = undefined;
        if (gate.phase !== 'ready' || !gate.memberIds[user.uid]) {
          setMessages([]);
          setLoading(false);
          setError('O grupo está atualizando ou seu acesso foi encerrado.');
          return;
        }
        setError('');
        removeMessages = watchMessages(
          id,
          (values) => {
            setMessages(values);
            setLoading(false);
          },
          fail,
        );
      },
      fail,
    );
    return () => {
      removeGate();
      removeMessages?.();
    };
  }, [id, user, retry]);
  return { messages, loading, error, reload };
}
