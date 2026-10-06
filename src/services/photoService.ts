import * as ImagePicker from 'expo-image-picker';
import { photoUploadInputSchema, photoUploadSchema } from '../../shared/contracts';
import { apiRequest } from './api';
export type SelectedPhoto = { uri: string; mimeType: string };
export async function choosePhoto(): Promise<SelectedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      'Permita acesso às fotos nas configurações do aparelho para escolher uma imagem.',
    );
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.75,
  });
  const photo = result.assets?.[0];
  if (result.canceled || !photo) return null;
  if (photo.fileSize && photo.fileSize >= 5 * 1024 * 1024)
    throw new Error('Escolha uma imagem menor que 5 MB.');
  return { uri: photo.uri, mimeType: photo.mimeType ?? 'image/jpeg' };
}
export async function uploadPhoto(photo: SelectedPhoto): Promise<string> {
  const response = await fetch(photo.uri);
  const blob = await response.blob();
  if (blob.size >= 5 * 1024 * 1024) throw new Error('Escolha uma imagem menor que 5 MB.');
  const input = photoUploadInputSchema.safeParse({ mimeType: photo.mimeType, size: blob.size });
  if (!input.success) throw new Error('Escolha uma imagem JPEG, PNG ou WebP menor que 5 MB.');
  const upload = await apiRequest('/photos/uploads', photoUploadSchema, {
    method: 'POST',
    body: input.data,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const result = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': input.data.mimeType, 'x-upsert': 'false' },
      body: blob,
      signal: controller.signal,
    });
    if (!result.ok) throw new Error('Não foi possível enviar a foto. Tente novamente.');
    return upload.photoUrl;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('O envio da foto demorou a responder. Tente novamente.');
    if (error instanceof TypeError)
      throw new Error('Verifique sua conexão e tente enviar a foto novamente.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
