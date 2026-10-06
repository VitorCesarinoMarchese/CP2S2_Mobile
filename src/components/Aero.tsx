import React, { useEffect, useState, type PropsWithChildren, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';
export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({
  name,
  size = 22,
  color = colors.aqua,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand}>
      <LinearGradient
        colors={['#91ecf7', '#13a4c4', '#087cb0']}
        style={[styles.brandMark, compact && { width: 38, height: 38, borderRadius: 13 }]}
      >
        <View style={styles.markShine} />
        <Icon name="chatbubbles" size={compact ? 23 : 32} color="white" />
      </LinearGradient>
      <Text style={[styles.brandName, compact && { fontSize: 27 }]}>
        brisa<Text style={{ color: colors.aqua }}>.</Text>
      </Text>
    </View>
  );
}
export function Screen({
  children,
  scroll = true,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  return (
    <LinearGradient
      colors={['#a7dcf2', '#e8f8ff', '#edf7e5']}
      locations={[0, 0.53, 1]}
      style={{ flex: 1, overflow: 'hidden' }}
    >
      <View style={[styles.skyOrb, { pointerEvents: 'none' }]} />
      <View style={[styles.hill, { pointerEvents: 'none' }]} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.screenContent, style]}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.screenContent, { flex: 1 }, style]}>{children}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
export function Surface({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.surface, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  icon,
  loading = false,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonOuter,
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      <LinearGradient
        colors={secondary ? ['#ffffff', '#e4f4f9'] : ['#08718b', '#076b88', '#075575']}
        locations={secondary ? [0, 1] : [0, 0.5, 1]}
        style={styles.button}
      >
        <View style={[styles.buttonShine, { pointerEvents: 'none' }]} />
        {loading ? (
          <ActivityIndicator color={secondary ? colors.aqua : 'white'} />
        ) : icon ? (
          <Icon name={icon} size={20} color={secondary ? colors.aqua : 'white'} />
        ) : null}
        <Text style={[styles.buttonText, secondary && { color: colors.ink }]}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}
export function Field({
  label,
  icon,
  ...props
}: TextInputProps & { label: string; icon?: IconName }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        {icon && <Icon name={icon} size={20} color={colors.muted} />}
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor="#536e80"
          style={[styles.input, props.style]}
        />
      </View>
    </View>
  );
}
export function Avatar({
  uri,
  name = '',
  size = 48,
  group = false,
  onPress,
}: {
  uri?: string;
  name?: string;
  size?: number;
  group?: boolean;
  onPress?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const inner = (
    <LinearGradient
      colors={group ? ['#d5f0b2', '#76b454'] : ['#cbf7ff', '#63b6d5']}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={{ width: size, height: size }}
          accessibilityLabel={`Foto de ${name}`}
        />
      ) : (
        <Icon
          name={group ? 'people' : 'person'}
          size={size * 0.44}
          color={group ? '#2f5c1d' : '#1b5870'}
        />
      )}
    </LinearGradient>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${group ? 'integrantes de' : 'perfil de'} ${name}`}
      onPress={onPress}
      style={{ minWidth: 48, minHeight: 48, justifyContent: 'center' }}
    >
      {inner}
    </Pressable>
  ) : (
    inner
  );
}
export function ErrorMessage({ text }: { text: string }) {
  return text ? (
    <View accessibilityRole="alert" style={styles.error}>
      <Icon name="alert-circle-outline" color={colors.error} size={20} />
      <Text style={{ color: colors.error, flex: 1, fontSize: 14, lineHeight: 21 }}>{text}</Text>
    </View>
  ) : null;
}
export function Loading() {
  return (
    <View style={{ padding: 36 }}>
      <ActivityIndicator size="large" color={colors.aqua} />
      <Text style={[styles.body, { textAlign: 'center', marginTop: 12 }]}>Só um instante…</Text>
    </View>
  );
}
export function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <LinearGradient colors={['#fff', '#d1eef8']} style={styles.emptyIcon}>
        <Icon name={icon} size={38} />
      </LinearGradient>
      <Text style={styles.subtitle}>{title}</Text>
      <Text style={[styles.body, { textAlign: 'center', maxWidth: 300 }]}>{text}</Text>
    </View>
  );
}
export const styles = StyleSheet.create({
  screenContent: {
    padding: 22,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    gap: 20,
    flexGrow: 1,
  },
  skyOrb: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: '#ffffff50',
  },
  hill: {
    position: 'absolute',
    bottom: -210,
    left: '-15%',
    width: '130%',
    height: 300,
    borderRadius: 180,
    backgroundColor: '#91c66b30',
    transform: [{ rotate: '-8deg' }],
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0px 5px 12px #12608430',
  },
  markShine: {
    position: 'absolute',
    top: 2,
    width: '92%',
    height: '42%',
    borderRadius: 18,
    backgroundColor: '#ffffff35',
  },
  brandName: { fontSize: 38, fontWeight: '700', color: colors.ink, letterSpacing: -1 },
  surface: {
    backgroundColor: '#ffffffcf',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0px 8px 28px #24587812',
  },
  buttonOuter: { borderRadius: 14, overflow: 'hidden', minHeight: 50 },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    minHeight: 50,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonShine: {
    position: 'absolute',
    top: 1,
    left: 2,
    right: 2,
    height: '44%',
    borderRadius: 12,
    backgroundColor: '#ffffff1c',
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: 'white' },
  field: {
    backgroundColor: '#f9fdff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 50, paddingVertical: 12 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '700', color: colors.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: 21, fontWeight: '600', color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted },
  error: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    backgroundColor: '#fff0ed',
    borderRadius: 12,
  },
  empty: { paddingVertical: 38, alignItems: 'center', gap: 12 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  separator: { height: 1, backgroundColor: '#d7e9ef', marginVertical: 14 },
  link: { color: colors.aqua, fontWeight: '600', fontSize: 15 },
  pill: {
    backgroundColor: '#e1f4ee',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    color: '#306346',
    fontSize: 12,
    fontWeight: '600',
  },
});
