import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatGroup } from '../../shared/contracts';
import type { RootStackParams } from '../types/navigation';
import {
  Avatar,
  Button,
  ErrorMessage,
  Icon,
  Loading,
  Screen,
  Surface,
  styles,
} from '../components/Aero';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../hooks/useConversations';
import { getConversation } from '../services/chatService';
import { readableError } from '../utils/errors';
export function MembersScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, 'Members'>) {
  const { user } = useAuth();
  const { users } = useUsers();
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [error, setError] = useState('');
  const directory = useMemo(() => new Map(users.map((person) => [person.uid, person])), [users]);
  useEffect(() => {
    let active = true;
    void getConversation(route.params.conversationId)
      .then((value) => {
        if (active && value.type === 'group') setGroup(value);
      })
      .catch((cause) => active && setError(readableError(cause)));
    return () => {
      active = false;
    };
  }, [route.params.conversationId]);
  return (
    <Screen style={{ maxWidth: 680 }}>
      <Text style={styles.title}>{group?.name ?? 'Integrantes'}</Text>
      <Text style={styles.body}>Toque em alguém para conhecer seu perfil.</Text>
      <ErrorMessage text={error} />
      {!group && !error ? (
        <Loading />
      ) : (
        group && (
          <Surface style={{ gap: 16 }}>
            <View style={[styles.row, { justifyContent: 'center' }]}>
              <Avatar uri={group.photoUrl} group size={82} name={group.name} />
              <Text style={styles.pill}>
                {group.memberIds.length} / {group.memberLimit} integrantes
              </Text>
            </View>
            {group.memberIds.map((uid) => {
              const member = directory.get(uid);
              return (
                <Pressable
                  key={uid}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver perfil de ${member?.name ?? 'integrante'}`}
                  onPress={() => navigation.navigate('Profile', { uid })}
                  style={[styles.row, { paddingVertical: 8 }]}
                >
                  <Avatar uri={member?.photoUrl} name={member?.name} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subtitle}>{member?.name ?? 'Integrante'}</Text>
                    {uid === group.ownerId && <Text style={styles.body}>Proprietário</Text>}
                  </View>
                  <Icon name="chevron-forward" />
                </Pressable>
              );
            })}
            {group.ownerId === user?.uid && (
              <Button
                title="Gerenciar integrantes"
                icon="settings-outline"
                onPress={() => navigation.navigate('GroupForm', { groupId: group.id })}
              />
            )}
          </Surface>
        )
      )}
    </Screen>
  );
}
