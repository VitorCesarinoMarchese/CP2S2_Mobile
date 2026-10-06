export type PhotoFile = { body: Blob | ArrayBuffer; size: number };
export async function readPhotoFile(uri: string): Promise<PhotoFile> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Não foi possível abrir a foto. Selecione novamente.');
  const body = await response.blob();
  return { body, size: body.size };
}
