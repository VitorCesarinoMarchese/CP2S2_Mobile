import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  getMessaging,
  deleteToken,
  getToken,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import { z } from 'zod';
import { apiRequest } from './api';
import { auth } from './firebase';
import type { NotificationDestination } from './notificationService';
const destinationSchema = z.object({
  conversationId: z.string(),
  conversationType: z.enum(['direct', 'group']),
});
let refreshListener: (() => void) | null = null;
let epoch = 0;
let tokenFeedback: ((text: string) => void) | null = null;
const tokenUpdates = new Set<Promise<unknown>>();
async function deviceId() {
  const stored = await AsyncStorage.getItem('brisa-device-id');
  if (stored) return stored;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem('brisa-device-id', id);
  return id;
}
async function saveToken(token: string, expectedUid: string, expectedEpoch: number) {
  if (auth.currentUser?.uid !== expectedUid || epoch !== expectedEpoch) return;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  const id = await deviceId();
  if (auth.currentUser?.uid !== expectedUid || epoch !== expectedEpoch) return;
  const update = apiRequest(`/devices/${id}`, z.undefined(), {
    method: 'PUT',
    body: { token, platform: Platform.OS, enabled: true },
  });
  tokenUpdates.add(update);
  try {
    await update;
  } finally {
    tokenUpdates.delete(update);
  }
}
export async function registerDevice(): Promise<string> {
  const expectedUid = auth.currentUser?.uid;
  if (!expectedUid) throw new Error('Entre na sua conta para ativar notificações.');
  const expectedEpoch = ++epoch;
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Mensagens',
      importance: Notifications.AndroidImportance.HIGH,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    return 'Notificações desativadas. Você pode permitir nas configurações do aparelho.';
  const token = await getToken(getMessaging());
  if (!token) return 'Não foi possível obter o token deste aparelho. Tente novamente.';
  await saveToken(token, expectedUid, expectedEpoch);
  if (epoch !== expectedEpoch || auth.currentUser?.uid !== expectedUid)
    return 'Registro de dispositivo encerrado.';
  refreshListener?.();
  refreshListener = onTokenRefresh(getMessaging(), (token) => {
    void saveToken(token, expectedUid, expectedEpoch).catch(() =>
      tokenFeedback?.(
        'Não foi possível atualizar o token. Ative as notificações novamente no perfil.',
      ),
    );
  });
  return 'Notificações ativadas neste aparelho.';
}
export async function unregisterDevice(): Promise<void> {
  epoch += 1;
  refreshListener?.();
  refreshListener = null;
  await Promise.allSettled([...tokenUpdates]);
  try {
    await apiRequest(`/devices/${await deviceId()}`, z.undefined(), { method: 'DELETE' });
  } finally {
    await deleteToken(getMessaging());
  }
}
export function observeNotifications(
  open: (destination: NotificationDestination) => void,
  foreground: (text: string) => void,
): () => void {
  tokenFeedback = foreground;
  const navigate = (data: unknown) => {
    const destination = destinationSchema.safeParse(data);
    if (destination.success) open(destination.data);
  };
  const opened = onNotificationOpenedApp(getMessaging(), (message) => navigate(message.data));
  const received = onMessage(getMessaging(), (message) =>
    foreground(message.notification?.body ?? 'Você recebeu uma nova mensagem.'),
  );
  let active = true;
  void getInitialNotification(getMessaging())
    .then((message) => {
      if (active && message) navigate(message.data);
    })
    .catch(() => foreground('Não foi possível abrir a notificação.'));
  return () => {
    tokenFeedback = null;
    active = false;
    opened();
    received();
    refreshListener?.();
    refreshListener = null;
  };
}
