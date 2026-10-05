import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../types/navigation';
import {
  Avatar,
  Button,
  Empty,
  ErrorMessage,
  Field,
  Loading,
  Screen,
  Surface,
  styles,
} from '../components/Aero';
import { useUsers } from '../hooks/useConversations';
import { startDirect } from '../services/chatService';
import { readableError } from '../utils/errors';
export function UsersScreen({ navigation }: NativeStackScreenProps<RootStackParams, 'Users'>) {
  const [search, setSearch] = useState('');
  const { filtered, loading, error, reload } = useUsers(search);
  const [busy, setBusy] = useState('');
  const [failure, setFailure] = useState('');
  const start = async (uid: string) => {
    setBusy(uid);
    setFailure('');
    try {
      const conversation = await startDirect(uid);
      navigation.replace('Chat', { conversationId: conversation.id });
    } catch (cause) {
      setFailure(readableError(cause));
    } finally {
      setBusy('');
    }
  };
  return (
    <Screen style={{ maxWidth: 700 }}>
      <Text style={styles.title}>Quem vai receber seu olá?</Text>
      <Text style={styles.body}>Encontre alguém e comece uma conversa.</Text>
      <Field
        label="Buscar pessoa"
        value={search}
        onChangeText={setSearch}
        placeholder="Digite um nome"
        icon="search-outline"
      />
      <ErrorMessage text={error || failure} />
      <Surface>
        {error ? (
          <Button title="Tentar carregar pessoas" secondary onPress={reload} />
        ) : loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty
            icon="people-outline"
            title="Ninguém por aqui ainda"
            text="Convide outra pessoa para se cadastrar ou tente um nome diferente."
          />
        ) : (
          filtered.map((person, index) => (
            <View key={person.uid}>
              {index > 0 && <View style={styles.separator} />}
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                <Avatar uri={person.photoUrl} name={person.name} />
                <Text style={[styles.subtitle, { flex: 1, fontSize: 17 }]}>{person.name}</Text>
                <Button
                  title="Conversar"
                  icon="chatbubble-outline"
                  loading={busy === person.uid}
                  disabled={Boolean(busy)}
                  onPress={() => void start(person.uid)}
                />
              </View>
            </View>
          ))
        )}
      </Surface>
    </Screen>
  );
}
