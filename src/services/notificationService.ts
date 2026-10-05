import { z } from 'zod';
export type NotificationDestination = {
  conversationId: string;
  conversationType: 'direct' | 'group';
};
export async function registerDevice(): Promise<string> {
  return 'O push está disponível no development build para Android e iOS.';
}
export async function unregisterDevice(): Promise<void> {}
export function observeNotifications(
  _open: (destination: NotificationDestination) => void,
  _foreground: (text: string) => void,
): () => void {
  return () => {};
}
