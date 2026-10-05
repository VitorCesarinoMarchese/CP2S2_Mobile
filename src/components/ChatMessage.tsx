import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ChatMessage as Message } from '../../shared/contracts';
import { colors } from '../theme/tokens';
export function ChatMessage({
  message,
  mine,
  author,
  target,
}: {
  message: Message;
  mine: boolean;
  author: string;
  target?: string;
}) {
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', paddingVertical: 5 }}>
      <LinearGradient
        colors={mine ? ['#daf6ff', '#b8e9f5'] : ['#ffffff', '#f5fbfe']}
        style={{
          maxWidth: '85%',
          padding: 14,
          borderRadius: 16,
          borderBottomRightRadius: mine ? 4 : 16,
          borderBottomLeftRadius: mine ? 16 : 4,
          gap: 5,
          boxShadow: '0px 3px 8px #154f6810',
        }}
      >
        {message.conversationType === 'group' && (
          <Text style={{ color: colors.aqua, fontWeight: '700', fontSize: 12 }}>
            {mine ? 'Você' : author}
          </Text>
        )}
        {target && <Text style={{ color: colors.green, fontSize: 12 }}>Para {target}</Text>}
        <Text selectable style={{ color: colors.ink, fontSize: 16, lineHeight: 24 }}>
          {message.text}
        </Text>
        <Text style={{ alignSelf: 'flex-end', fontSize: 11, color: colors.muted }}>
          {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </LinearGradient>
    </View>
  );
}
