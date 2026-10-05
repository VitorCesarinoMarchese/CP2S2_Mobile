import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatUser } from '../../shared/contracts';
import type { RootStackParams } from '../types/navigation';
import { Avatar, Button, ErrorMessage, Loading, Screen, Surface, styles } from '../components/Aero';
import { useAuth } from '../contexts/AuthContext';
import { getProfile } from '../services/userService';
import { registerDevice } from '../services/notificationService';
import { readableError } from '../utils/errors';
export function ProfileScreen({ route }: NativeStackScreenProps<RootStackParams, 'Profile'>) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pushStatus, setPushStatus] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setProfile(null);
    setLoading(true);
    void getProfile(route.params.uid)
      .then((value) => active && setProfile(value))
      .catch((cause) => active && setError(readableError(cause)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [route.params.uid]);
  const notifications = async () => {
    setBusy(true);
    try {
      setPushStatus(await registerDevice());
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen style={{ maxWidth: 620 }}>
      <Text style={styles.title}>
        Um pouco sobre {user?.uid === route.params.uid ? 'você' : 'essa pessoa'}
      </Text>
      <ErrorMessage text={error} />
      {loading ? (
        <Loading />
      ) : (
        profile && (
          <Surface style={{ gap: 20 }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <Avatar uri={profile.photoUrl} name={profile.name} size={100} />
              <Text style={styles.subtitle}>{profile.name}</Text>
            </View>
            {[
              { label: 'E-mail', value: profile.email },
              { label: 'Celular', value: profile.phoneNumber },
              {
                label: 'Data de nascimento',
                value: profile.birthDate.split('-').reverse().join('/'),
              },
            ].map((field) => (
              <View key={field.label} style={{ gap: 5 }}>
                <Text style={styles.label}>{field.label}</Text>
                <Text selectable style={styles.body}>
                  {field.value || 'Não informado'}
                </Text>
              </View>
            ))}
          </Surface>
        )
      )}
      {user?.uid === route.params.uid && (
        <Surface style={{ gap: 14 }}>
          <Text style={styles.subtitle}>Não perca um olá</Text>
          <Text style={styles.body}>
            Ative as notificações deste aparelho. A política de cada grupo define quais mensagens
            enviam push.
          </Text>
          <Button
            title="Ativar notificações"
            icon="notifications-outline"
            loading={busy}
            onPress={() => void notifications()}
          />
          {Boolean(pushStatus) && (
            <Text accessibilityRole="alert" style={styles.body}>
              {pushStatus}
            </Text>
          )}
        </Surface>
      )}
    </Screen>
  );
}
