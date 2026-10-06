import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { photoUploadInputSchema, photoUploadSchema } from '../../../shared/contracts';
import { ApiError } from './conversations';

const bucketSchema = z.object({
  public: z.literal(true),
  file_size_limit: z
    .number()
    .positive()
    .max(5 * 1024 * 1024 - 1),
  allowed_mime_types: z.array(photoUploadInputSchema.shape.mimeType).min(1),
});

export async function authorizePhotoUpload(
  uid: string,
  input: z.infer<typeof photoUploadInputSchema>,
): Promise<z.infer<typeof photoUploadSchema>> {
  const projectUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !key)
    throw new ApiError(503, 'O armazenamento de fotos ainda não foi configurado.');
  const base = z.url().parse(projectUrl).replace(/\/$/, '');
  const bucket = 'brisa-photos';
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const settings = await fetch(`${base}/storage/v1/bucket/${bucket}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!settings.ok) throw new ApiError(503, 'O armazenamento de fotos está indisponível.');
    const parsed = bucketSchema.safeParse(await settings.json());
    if (!parsed.success)
      throw new ApiError(503, 'Configure o limite e os formatos do bucket de fotos.');
    if (
      input.size > parsed.data.file_size_limit ||
      !parsed.data.allowed_mime_types.includes(input.mimeType)
    )
      throw new ApiError(400, 'Escolha uma imagem JPEG, PNG ou WebP menor que 5 MB.');
    const extension = input.mimeType === 'image/jpeg' ? 'jpg' : input.mimeType.split('/')[1];
    const path = `${uid}/${randomUUID()}.${extension}`;
    const signed = await fetch(`${base}/storage/v1/object/upload/sign/${bucket}/${path}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(15_000),
    });
    if (!signed.ok) throw new ApiError(503, 'Não foi possível autorizar o envio da foto.');
    const result = z.object({ url: z.string() }).parse(await signed.json());
    const uploadUrl = new URL(`${base}/storage/v1${result.url}`);
    if (!uploadUrl.searchParams.has('token'))
      throw new ApiError(503, 'Não foi possível autorizar o envio da foto.');
    return photoUploadSchema.parse({
      uploadUrl: uploadUrl.toString(),
      photoUrl: `${base}/storage/v1/object/public/${bucket}/${path}`,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'Não foi possível conectar ao armazenamento de fotos.');
  }
}
