import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, Button, ErrorMessage, Field, Screen, Surface, styles } from '../components/Aero';
import { useAuth } from '../contexts/AuthContext';
import { createAccount } from '../services/authService';
import { profileInputSchema } from '../../shared/contracts';
import { saveProfile } from '../services/userService';
import { choosePhoto, uploadPhoto, type SelectedPhoto } from '../services/photoService';
import { readableError } from '../utils/errors';
export function RegisterScreen() {
  const { user, error: sessionError, signOut } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async () => {
    try {
      const selected = await choosePhoto();
      if (selected) setPhoto(selected);
    } catch (cause) {
      setError(readableError(cause));
    }
  };
  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const draft = profileInputSchema.safeParse({
        name,
        phoneNumber: phone,
        birthDate,
        photoUrl: '',
      });
      if (!draft.success) throw new Error(draft.error.issues[0]?.message ?? 'Verifique os campos.');
      if (!user && (password.length < 6 || password !== confirmation))
        throw new Error('Use pelo menos 6 caracteres e confirme a mesma senha.');
      if (!user) await createAccount(email, password);
      const photoUrl = photo ? await uploadPhoto(photo) : '';
      await saveProfile({ ...draft.data, photoUrl });
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen style={{ maxWidth: 580 }}>
      <Text style={styles.title}>{user ? 'Complete seu perfil' : 'Seu lugar na Brisa'}</Text>
      <Text style={styles.body}>Um rosto, um nome e muitas conversas pela frente.</Text>
      <Surface style={{ gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Avatar uri={photo?.uri} size={88} name={name} />
          <Button
            title={photo ? 'Trocar foto' : 'Escolher foto'}
            icon="image-outline"
            secondary
            onPress={() => void pick()}
          />
        </View>
        <Field
          label="Nome"
          value={name}
          onChangeText={setName}
          placeholder="Como você quer ser chamado?"
          autoComplete="name"
        />
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          editable={!user}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="voce@exemplo.com"
        />
        {!user && (
          <>
            <Field
              label="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Pelo menos 6 caracteres"
            />
            <Field
              label="Confirmar senha"
              value={confirmation}
              onChangeText={setConfirmation}
              secureTextEntry
              placeholder="Repita sua senha"
            />
          </>
        )}
        <Field
          label="Celular"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="(11) 99999-9999"
        />
        <Field
          label="Data de nascimento"
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="AAAA-MM-DD"
          maxLength={10}
        />
        <Text style={[styles.body, { fontSize: 13 }]}>
          Seu e-mail, celular e nascimento ficam disponíveis apenas para quem compartilha uma
          conversa com você.
        </Text>
        <ErrorMessage text={error || sessionError} />
        <Button
          title={user ? 'Salvar e começar' : 'Criar minha conta'}
          loading={busy}
          icon="leaf-outline"
          onPress={() => void submit()}
        />
        {user && (
          <Button
            title="Sair da conta"
            secondary
            onPress={() => void signOut().catch((cause) => setError(readableError(cause)))}
          />
        )}
      </Surface>
    </Screen>
  );
}
