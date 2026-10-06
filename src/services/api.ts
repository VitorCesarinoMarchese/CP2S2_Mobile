import { z } from 'zod';
import { auth } from './firebase';
const errorSchema = z.object({ error: z.string() });
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) throw new Error('A API ainda não foi configurada. Defina EXPO_PUBLIC_API_URL.');
  if (!auth.currentUser) throw new Error('Entre na sua conta para continuar.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
        'Content-Type': 'application/json',
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
    if (response.status === 204) return schema.parse(undefined);
    const body: unknown = await response.json();
    if (!response.ok) {
      const error = errorSchema.safeParse(body);
      throw new Error(
        error.success ? error.data.error : 'O serviço não conseguiu concluir a ação.',
      );
    }
    return schema.parse(body);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('O serviço demorou a responder. Verifique sua conexão e tente novamente.');
    if (error instanceof TypeError)
      throw new Error('Não foi possível conectar à API. Verifique sua conexão.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
