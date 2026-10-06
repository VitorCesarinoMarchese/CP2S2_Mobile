import { File } from 'expo-file-system';
import type { PhotoFile } from './photoFile';
export async function readPhotoFile(uri: string): Promise<PhotoFile> {
  const file = new File(uri);
  if (!file.exists) throw new Error('Não foi possível abrir a foto. Selecione novamente.');
  if (file.size >= 5 * 1024 * 1024) throw new Error('Escolha uma imagem menor que 5 MB.');
  const body = await file.arrayBuffer();
  return { body, size: body.byteLength };
}
