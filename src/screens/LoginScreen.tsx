import React, { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../types/navigation';
import {
  Brand,
  Button,
  ErrorMessage,
  Field,
  Icon,
  Screen,
  Surface,
  styles,
} from '../components/Aero';
import { login } from '../services/authService';
import { readableError } from '../utils/errors';
import { colors } from '../theme/tokens';
export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParams, 'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  };
  const wide = width >= 760;
  return (
    <Screen style={{ justifyContent: 'center', paddingVertical: wide ? 70 : 28 }}>
      <View style={[{ gap: 36 }, wide && { flexDirection: 'row', alignItems: 'center', gap: 64 }]}>
        <View style={{ flex: wide ? 1 : undefined, gap: 22 }}>
          <Brand />
          <View
            style={{
              alignSelf: wide ? 'flex-start' : 'center',
              width: 180,
              height: 150,
              marginVertical: 8,
            }}
          >
            <LinearGradient
              colors={['#d2faff', '#49c4e2', '#087baa']}
              style={{
                width: 128,
                height: 128,
                borderRadius: 64,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0px 14px 25px #1685a533',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: 7,
                  left: 17,
                  width: 92,
                  height: 42,
                  borderRadius: 46,
                  backgroundColor: '#ffffff60',
                }}
              />
              <Icon name="chatbubbles-outline" size={60} color="white" />
            </LinearGradient>
            <LinearGradient
              colors={['#e8ffd7', '#94cf52', '#478b20']}
              style={{
                position: 'absolute',
                width: 65,
                height: 65,
                right: 5,
                bottom: 0,
                borderRadius: 33,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0px 6px 12px #407d2333',
              }}
            >
              <Icon name="leaf-outline" size={30} color="white" />
            </LinearGradient>
            <View
              style={{
                position: 'absolute',
                right: 5,
                top: 5,
                width: 23,
                height: 23,
                borderRadius: 12,
                backgroundColor: '#ffffffa0',
              }}
            />
          </View>
          <Text style={[styles.title, { fontSize: wide ? 44 : 34, lineHeight: wide ? 49 : 40 }]}>
            Uma conversa.{'\n'}Um novo respiro.
          </Text>
          <Text style={[styles.body, { maxWidth: 340 }]}>
            Seu espaço para ficar perto. Converse com quem importa e reúna sua turma em um só lugar.
          </Text>
          <View style={[styles.row, { gap: 8 }]}>
            <Icon name="lock-closed-outline" size={16} color="#306346" />
            <Text style={{ color: '#306346', fontSize: 13 }}>Sua conta. Suas conversas.</Text>
          </View>
        </View>
        <Surface style={{ flex: wide ? 1 : undefined, gap: 22, padding: wide ? 32 : 24 }}>
          <View style={{ gap: 7 }}>
            <Text style={styles.subtitle}>Que bom ter você aqui</Text>
            <Text style={styles.body}>Entre na Brisa e continue a conversa.</Text>
          </View>
          <Field
            label="E-mail"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Senha"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="Sua senha"
            secureTextEntry
            autoComplete="current-password"
            onSubmitEditing={() => void submit()}
          />
          <ErrorMessage text={error} />
          <Button
            title="Entrar"
            icon="arrow-forward"
            loading={busy}
            disabled={!email.trim() || !password}
            onPress={() => void submit()}
          />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={styles.body}>Ainda não tem uma conta?</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Register')}
              style={{ padding: 12, minHeight: 48, justifyContent: 'center' }}
            >
              <Text style={styles.link}>Criar minha conta</Text>
            </Pressable>
          </View>
        </Surface>
      </View>
      <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: 26 }}>
        Feito para aproximar, com um pouco de leveza.
      </Text>
    </Screen>
  );
}
