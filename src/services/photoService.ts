import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from './firebase';
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
  const user = auth.currentUser;
  if (!user) throw new Error('Entre na sua conta antes de enviar a foto.');
  const response = await fetch(photo.uri);
  const blob = await response.blob();
  if (blob.size >= 5 * 1024 * 1024) throw new Error('Escolha uma imagem menor que 5 MB.');
  const object = ref(storage, `photos/${user.uid}/${Crypto.randomUUID()}`);
  await uploadBytes(object, blob, { contentType: photo.mimeType });
  return getDownloadURL(object);
}
