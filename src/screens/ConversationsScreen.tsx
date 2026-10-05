import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../types/navigation';
import {
  Avatar,
  Brand,
  Button,
  Empty,
  ErrorMessage,
  Field,
  Icon,
  Loading,
  Screen,
  Surface,
  styles,
} from '../components/Aero';
import { useAuth } from '../contexts/AuthContext';
import { useConversations, useUsers } from '../hooks/useConversations';
import { readableError } from '../utils/errors';
import { colors } from '../theme/tokens';
export function ConversationsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParams, 'Conversations'>) {
  const { user, profile, signOut } = useAuth();
  const { conversations, loading, error, reload } = useConversations();
  const { users } = useUsers();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'direct' | 'group'>('all');
  const [logoutError, setLogoutError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const directory = useMemo(() => new Map(users.map((person) => [person.uid, person])), [users]);
  const rows = useMemo(
    () =>
      conversations
        .map((conversation) => {
          const other =
            conversation.type === 'direct'
              ? directory.get(conversation.participantIds.find((uid) => uid !== user?.uid) ?? '')
              : undefined;
          return {
            conversation,
            name:
              conversation.type === 'group'
                ? conversation.name
                : (other?.name ?? 'Conversa individual'),
            photo: conversation.type === 'group' ? conversation.photoUrl : other?.photoUrl,
          };
        })
        .filter(
          (row) =>
            (tab === 'all' || row.conversation.type === tab) &&
            row.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
        ),
    [conversations, directory, user?.uid, tab, search],
  );
  const leave = async () => {
    setLeaving(true);
    try {
      await signOut();
    } catch (cause) {
      setLogoutError(readableError(cause));
    } finally {
      setLeaving(false);
    }
  };
  return (
    <Screen style={{ maxWidth: 760 }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Brand compact />
        <Avatar
          uri={profile?.photoUrl}
          name={profile?.name}
          onPress={() => user && navigation.navigate('Profile', { uid: user.uid })}
        />
      </View>
      <Surface style={{ padding: 25, backgroundColor: '#ffffff90' }}>
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>Olá, {profile?.name.split(' ')[0] ?? 'você'}.</Text>
          <Text style={styles.body}>A conversa fica melhor com você por aqui.</Text>
        </View>
        <View style={[styles.row, { marginTop: 22, flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <Button
              title="Nova conversa"
              icon="chatbubble-outline"
              onPress={() => navigation.navigate('Users')}
            />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <Button
              title="Criar grupo"
              icon="people-outline"
              secondary
              onPress={() => navigation.navigate('GroupForm')}
            />
          </View>
        </View>
      </Surface>
      <View style={{ gap: 16 }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.subtitle}>Suas conversas</Text>
          <Text style={styles.pill}>
            {conversations.length} {conversations.length === 1 ? 'conversa' : 'conversas'}
          </Text>
        </View>
        <Field
          label="Buscar conversa"
          icon="search-outline"
          placeholder="Pessoa ou grupo"
          value={search}
          onChangeText={setSearch}
        />
        <View style={[styles.row, { gap: 8 }]}>
          {(
            [
              { id: 'all', label: 'Todas' },
              { id: 'direct', label: 'Pessoas' },
              { id: 'group', label: 'Grupos' },
            ] satisfies { id: typeof tab; label: string }[]
          ).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.id }}
              onPress={() => setTab(item.id)}
              style={{
                paddingHorizontal: 19,
                paddingVertical: 13,
                minHeight: 48,
                borderRadius: 24,
                backgroundColor: tab === item.id ? '#167c99' : '#ffffffb0',
              }}
            >
              <Text style={{ fontWeight: '600', color: tab === item.id ? 'white' : colors.muted }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ErrorMessage text={error || logoutError} />
      <Surface style={{ padding: 16 }}>
        {error ? (
          <Button title="Tentar carregar conversas" secondary onPress={reload} />
        ) : loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty
            icon="chatbubbles-outline"
            title={search ? 'Nenhuma conversa encontrada' : 'Dê o primeiro olá'}
            text={
              search
                ? 'Tente outro nome ou escolha outro filtro.'
                : 'Escolha uma pessoa ou crie um grupo. Suas conversas aparecerão aqui.'
            }
          />
        ) : (
          rows.map(({ conversation, name, photo }, index) => (
            <View key={conversation.id}>
              {index > 0 && <View style={styles.separator} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Abrir conversa ${name}`}
                onPress={() => navigation.navigate('Chat', { conversationId: conversation.id })}
                style={[styles.row, { paddingVertical: 9, paddingHorizontal: 4 }]}
              >
                <Avatar uri={photo} name={name} group={conversation.type === 'group'} size={55} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>{name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    {conversation.type === 'group'
                      ? `${conversation.memberIds.length} integrantes · ${conversation.memberLimit - conversation.memberIds.length} vagas`
                      : 'Conversa individual'}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))
        )}
      </Surface>
      <View style={{ alignItems: 'center', marginTop: 'auto' }}>
        <Button
          title="Sair da conta"
          secondary
          icon="log-out-outline"
          loading={leaving}
          onPress={() => void leave()}
        />
      </View>
    </Screen>
  );
}
