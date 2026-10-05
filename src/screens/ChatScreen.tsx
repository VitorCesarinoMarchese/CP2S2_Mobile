import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, Pressable, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  participants,
  type ChatMessage as Message,
  type Conversation,
  type MessageInput,
} from '../../shared/contracts';
import type { RootStackParams } from '../types/navigation';
import {
  Avatar,
  Button,
  Empty,
  ErrorMessage,
  Icon,
  Loading,
  Screen,
  styles,
} from '../components/Aero';
import { ChatMessage } from '../components/ChatMessage';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { useUsers } from '../hooks/useConversations';
import { getConversation, sendMessage, watchConversation } from '../services/chatService';
import { apiRequest } from '../services/api';
import { readableError } from '../utils/errors';
import { colors } from '../theme/tokens';
export function ChatScreen({ route, navigation }: NativeStackScreenProps<RootStackParams, 'Chat'>) {
  const id = route.params.conversationId;
  const { user } = useAuth();
  const { users } = useUsers();
  const { messages, loading, error: listenerError, reload } = useChat(id);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState('');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingPush, setPendingPush] = useState<string | null>(null);
  const pendingMessage = useRef<MessageInput | null>(null);
  const list = useRef<FlatList<Message>>(null);
  const directory = useMemo(() => new Map(users.map((person) => [person.uid, person])), [users]);
  const load = useCallback(async () => {
    try {
      setConversation(await getConversation(id));
      setError('');
    } catch (cause) {
      setError(readableError(cause));
    }
  }, [id]);
  useEffect(() => {
    let active = true;
    setConversation(null);
    setTarget('');
    setText('');
    pendingMessage.current = null;
    setPendingPush(null);
    void getConversation(id)
      .then((value) => {
        if (active) setConversation(value);
      })
      .catch((cause) => active && setError(readableError(cause)));
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (!conversation) return;
    return watchConversation(id, conversation.type, setConversation, (cause) => {
      setError(readableError(cause));
      setConversation(null);
    });
  }, [id, conversation?.type]);
  const other =
    conversation?.type === 'direct'
      ? directory.get(conversation.participantIds.find((uid) => uid !== user?.uid) ?? '')
      : null;
  const name = conversation?.type === 'group' ? conversation.name : (other?.name ?? 'Conversa');
  const members = useMemo(
    () =>
      conversation
        ? participants(conversation)
            .filter((uid) => uid !== user?.uid)
            .map((uid) => ({ uid, name: directory.get(uid)?.name ?? 'Integrante' }))
        : [],
    [conversation, directory, user?.uid],
  );
  const push = async (messageId: string) => {
    await apiRequest(
      '/notifications/messages',
      z.object({ status: z.string(), delivered: z.number().optional() }),
      { method: 'POST', body: { conversationId: id, messageId } },
    );
  };
  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const previous = pendingMessage.current;
    const input: MessageInput =
      previous &&
      previous.text === text.trim() &&
      (previous.target.type === 'member' ? previous.target.memberId : '') === target
        ? previous
        : {
            id: Crypto.randomUUID(),
            text: text.trim(),
            target: target ? { type: 'member', memberId: target } : { type: 'conversation' },
            mentionedUserIds: target ? [target] : [],
          };
    pendingMessage.current = input;
    try {
      const message = await sendMessage(id, input);
      pendingMessage.current = null;
      setText('');
      setTarget('');
      try {
        await push(message.id);
        setPendingPush(null);
      } catch {
        setPendingPush(message.id);
        setNotice('Mensagem salva. O pedido de notificação falhou; você pode tentar novamente.');
      }
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  };
  const retryPush = async () => {
    if (!pendingPush) return;
    setBusy(true);
    try {
      await push(pendingPush);
      setPendingPush(null);
      setNotice('Pedido de notificação concluído.');
    } catch (cause) {
      setNotice(readableError(cause));
    } finally {
      setBusy(false);
    }
  };
  const viewPerson = () => {
    if (!conversation) return;
    if (conversation.type === 'group') navigation.navigate('Members', { conversationId: id });
    else if (other) navigation.navigate('Profile', { uid: other.uid });
  };
  return (
    <Screen scroll={false} style={{ maxWidth: 800, gap: 12 }}>
      <View style={[styles.row, { backgroundColor: '#ffffffaa', padding: 14, borderRadius: 16 }]}>
        <Avatar
          uri={conversation?.type === 'group' ? conversation.photoUrl : other?.photoUrl}
          name={name}
          group={conversation?.type === 'group'}
          onPress={viewPerson}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.subtitle, { fontSize: 19 }]}>{name}</Text>
          <Text style={[styles.body, { fontSize: 12 }]}>
            {conversation?.type === 'group'
              ? `${conversation.memberIds.length} integrantes · ${conversation.memberLimit - conversation.memberIds.length} vagas`
              : 'Conversa individual'}
          </Text>
        </View>
        {conversation?.type === 'group' && conversation.ownerId === user?.uid && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar grupo"
            style={{
              padding: 12,
              minWidth: 48,
              minHeight: 48,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => navigation.navigate('GroupForm', { groupId: id })}
          >
            <Icon name="settings-outline" />
          </Pressable>
        )}
      </View>
      <ErrorMessage text={error || listenerError} />
      {Boolean(listenerError || error) && (
        <Button
          title="Tentar reconectar"
          secondary
          onPress={() => {
            reload();
            void load();
          }}
        />
      )}
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 2, paddingVertical: 12, flexGrow: 1 }}
        data={messages}
        keyExtractor={(message) => message.id}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          listenerError || error ? null : loading ? (
            <Loading />
          ) : (
            <Empty
              icon="chatbubble-ellipses-outline"
              title="Um olá já é um começo"
              text="Envie a primeira mensagem desta conversa."
            />
          )
        }
        renderItem={({ item }) => (
          <ChatMessage
            message={item}
            mine={item.senderId === user?.uid}
            author={directory.get(item.senderId)?.name ?? 'Integrante'}
            target={
              item.target.type === 'member'
                ? (directory.get(item.target.memberId)?.name ?? 'integrante')
                : undefined
            }
          />
        )}
      />
      {Boolean(notice) && (
        <Text accessibilityRole="alert" style={styles.body}>
          {notice}
        </Text>
      )}
      {pendingPush && (
        <Button
          title="Tentar notificação novamente"
          secondary
          loading={busy}
          onPress={() => void retryPush()}
        />
      )}
      <View style={{ padding: 12, backgroundColor: '#ffffffda', borderRadius: 16, gap: 10 }}>
        {conversation?.type === 'group' && (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPicker((value) => !value)}
              style={[styles.row, { minHeight: 48 }]}
            >
              <Icon name="at-outline" size={19} />
              <Text style={styles.link}>
                {target
                  ? `Para ${directory.get(target)?.name ?? 'integrante'}`
                  : 'Para todo o grupo'}
              </Text>
              <Icon name={picker ? 'chevron-up' : 'chevron-down'} size={16} />
            </Pressable>
            {picker && (
              <ScrollView
                style={{ maxHeight: 200 }}
                contentContainerStyle={{ gap: 4 }}
                keyboardShouldPersistTaps="handled"
              >
                <Button
                  title="Todo o grupo"
                  secondary
                  onPress={() => {
                    setTarget('');
                    setPicker(false);
                  }}
                />
                {members.map((member) => (
                  <Button
                    key={member.uid}
                    title={member.name}
                    secondary
                    onPress={() => {
                      setTarget(member.uid);
                      setPicker(false);
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}
        <View style={[styles.row, { alignItems: 'flex-end' }]}>
          <TextInput
            accessibilityLabel="Mensagem"
            value={text}
            onChangeText={setText}
            placeholder="Escreva uma mensagem…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={4000}
            editable={!busy && !listenerError}
            style={{
              flex: 1,
              minHeight: 50,
              maxHeight: 130,
              backgroundColor: '#edf8fc',
              borderRadius: 12,
              padding: 13,
              color: colors.ink,
              fontSize: 16,
            }}
          />
          <Button
            title="Enviar"
            icon="send"
            loading={busy}
            disabled={!text.trim() || Boolean(listenerError) || !conversation}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </Screen>
  );
}
