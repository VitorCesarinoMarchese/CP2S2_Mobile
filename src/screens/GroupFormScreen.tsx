import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { groupInputSchema, type NotificationPolicy } from '../../shared/contracts';
import type { RootStackParams } from '../types/navigation';
import {
  Avatar,
  Button,
  ErrorMessage,
  Field,
  Icon,
  Loading,
  Screen,
  Surface,
  styles,
} from '../components/Aero';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../hooks/useConversations';
import { getConversation } from '../services/chatService';
import { createGroup, updateGroup, reconcileGroup } from '../services/groupService';
import { choosePhoto, uploadPhoto, type SelectedPhoto } from '../services/photoService';
import { readableError } from '../utils/errors';
import { colors } from '../theme/tokens';
export const policies: { id: NotificationPolicy; label: string; description: string }[] = [
  {
    id: 'all_group_messages',
    label: 'Todas as mensagens',
    description:
      'Mensagens gerais notificam todo o grupo. Mensagens direcionadas notificam os selecionados.',
  },
  {
    id: 'mentioned_members',
    label: 'Somente menções',
    description: 'Apenas os integrantes selecionados recebem push.',
  },
  {
    id: 'direct_messages_only',
    label: 'Somente conversas individuais',
    description: 'Este grupo não envia notificações push.',
  },
  { id: 'disabled', label: 'Desativadas', description: 'Nenhuma notificação desta conversa.' },
];
export function GroupFormScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, 'GroupForm'>) {
  const { user } = useAuth();
  const [version, setVersion] = useState(1);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('5');
  const [ids, setIds] = useState<string[]>(user ? [user.uid] : []);
  const [policy, setPolicy] = useState<NotificationPolicy>('all_group_messages');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [search, setSearch] = useState('');
  const { filtered, loading: loadingUsers, error: userError } = useUsers(search);
  const [loading, setLoading] = useState(Boolean(route.params?.groupId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [groupId] = useState(route.params?.groupId ?? `group_${Crypto.randomUUID()}`);
  useEffect(() => {
    const id = route.params?.groupId;
    if (!id) return;
    let active = true;
    void getConversation(id)
      .then((group) => {
        if (!active) return;
        if (group.type !== 'group' || group.ownerId !== user?.uid)
          throw new Error('Somente o proprietário pode editar o grupo.');
        setVersion(group.version);
        setName(group.name);
        setLimit(String(group.memberLimit));
        setIds(group.memberIds);
        setPolicy(group.notificationPolicy);
        setPhotoUrl(group.photoUrl);
      })
      .catch((cause) => active && setError(readableError(cause)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [route.params?.groupId, user?.uid]);
  const available = useMemo(() => Number(limit) - ids.length, [limit, ids.length]);
  const toggle = (uid: string) => {
    if (ids.includes(uid)) setIds((previous) => previous.filter((member) => member !== uid));
    else if (Number.isInteger(Number(limit)) && available > 0)
      setIds((previous) => [...previous, uid]);
    else setError('O grupo está sem vagas. Aumente o limite para adicionar alguém.');
  };
  const pick = async () => {
    try {
      const selected = await choosePhoto();
      if (selected) setPhoto(selected);
    } catch (cause) {
      setError(readableError(cause));
    }
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const draft = groupInputSchema.safeParse({
        name,
        photoUrl,
        memberIds: ids,
        memberLimit: Number(limit),
        notificationPolicy: policy,
      });
      if (!draft.success)
        throw new Error(draft.error.issues[0]?.message ?? 'Verifique os dados do grupo.');
      const finalPhoto = photo ? await uploadPhoto(photo) : photoUrl;
      const input = { ...draft.data, photoUrl: finalPhoto };
      const group = route.params?.groupId
        ? await updateGroup(groupId, input, version)
        : await createGroup(groupId, input);
      navigation.replace('Chat', { conversationId: group.id });
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  };
  const recover = async () => {
    setBusy(true);
    try {
      await reconcileGroup(groupId);
      navigation.replace('Chat', { conversationId: groupId });
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  return (
    <Screen style={{ maxWidth: 700 }}>
      <Text style={styles.title}>
        {route.params?.groupId ? 'Cuide do seu grupo' : 'Uma turma, um espaço'}
      </Text>
      <Text style={styles.body}>Reúna as pessoas e escolha como a conversa acontece.</Text>
      <Surface style={{ gap: 18 }}>
        <View style={[styles.row, { justifyContent: 'center' }]}>
          <Avatar uri={photo?.uri ?? photoUrl} group name={name} size={78} />
          <Button
            title="Escolher foto"
            secondary
            icon="image-outline"
            onPress={() => void pick()}
          />
        </View>
        <Field
          label="Nome do grupo"
          value={name}
          onChangeText={setName}
          placeholder="Como sua turma se chama?"
        />
        <Field
          label="Limite de integrantes"
          value={limit}
          onChangeText={setLimit}
          keyboardType="number-pad"
          placeholder="De 2 a 100, incluindo você"
        />
        <Text style={[styles.pill, { alignSelf: 'flex-start' }]}>
          {ids.length} integrantes · {Number.isFinite(available) ? Math.max(0, available) : 0} vagas
          disponíveis
        </Text>
        <Text style={[styles.subtitle, { fontSize: 18 }]}>Quem entra na conversa?</Text>
        <Text style={styles.body}>Você é o proprietário e já está incluído.</Text>
        <Field
          label="Buscar integrantes"
          value={search}
          onChangeText={setSearch}
          icon="search-outline"
          placeholder="Nome da pessoa"
        />
        {loadingUsers ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Text style={styles.body}>
            Nenhuma pessoa encontrada. Convide alguém para se cadastrar.
          </Text>
        ) : (
          filtered.map((person) => {
            const selected = ids.includes(person.uid);
            return (
              <Pressable
                key={person.uid}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={person.name}
                onPress={() => toggle(person.uid)}
                style={[styles.row, { paddingVertical: 9, minHeight: 56 }]}
              >
                <Avatar uri={person.photoUrl} name={person.name} />
                <Text style={{ flex: 1, color: colors.ink, fontSize: 16 }}>{person.name}</Text>
                <Icon
                  name={selected ? 'checkbox' : 'square-outline'}
                  color={selected ? colors.aqua : colors.muted}
                />
              </Pressable>
            );
          })
        )}
        <View style={styles.separator} />
        <Text style={[styles.subtitle, { fontSize: 18 }]}>Notificações do grupo</Text>
        {policies.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: policy === item.id }}
            accessibilityLabel={item.label}
            onPress={() => setPolicy(item.id)}
            style={[styles.row, { paddingVertical: 10, alignItems: 'flex-start' }]}
          >
            <Icon name={policy === item.id ? 'radio-button-on' : 'radio-button-off'} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 15 }}>
                {item.label}
              </Text>
              <Text style={[styles.body, { fontSize: 13, lineHeight: 20 }]}>
                {item.description}
              </Text>
            </View>
          </Pressable>
        ))}
        <ErrorMessage text={error || userError} />
        <Button
          title={route.params?.groupId ? 'Salvar alterações' : 'Criar grupo'}
          icon="people-outline"
          loading={busy}
          disabled={ids.length < 2 || available < 0}
          onPress={() => void save()}
        />
        {Boolean(error) && (
          <Button
            title="Concluir atualização interrompida"
            secondary
            loading={busy}
            onPress={() => void recover()}
          />
        )}
      </Surface>
    </Screen>
  );
}
