import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { RootStackParams } from './src/types/navigation';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ConversationsScreen } from './src/screens/ConversationsScreen';
import { UsersScreen } from './src/screens/UsersScreen';
import { GroupFormScreen } from './src/screens/GroupFormScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { MembersScreen } from './src/screens/MembersScreen';
import { Icon, Loading, Screen } from './src/components/Aero';
import { observeNotifications, registerDevice } from './src/services/notificationService';
import { colors } from './src/theme/tokens';
const Stack = createNativeStackNavigator<RootStackParams>();
const navigation = createNavigationContainerRef<RootStackParams>();
function Routes() {
  const { user, profile, loading } = useAuth();
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!user || !profile) {
      setNotice('');
      return;
    }
    const stop = observeNotifications((destination) => {
      if (navigation.isReady())
        navigation.navigate('Chat', { conversationId: destination.conversationId });
    }, setNotice);
    void registerDevice()
      .then((status) => {
        if (status.includes('desativadas') || status.includes('Não foi')) setNotice(status);
      })
      .catch(() => setNotice('Não foi possível ativar o push. Tente novamente no seu perfil.'));
    return stop;
  }, [user?.uid, profile?.uid]);
  if (loading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  return (
    <View style={{ flex: 1 }}>
      {Boolean(notice) && (
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#e5f6f2' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>
            <Text
              accessibilityRole="alert"
              style={{ flex: 1, color: colors.ink, paddingVertical: 14 }}
            >
              {notice}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar aviso de notificação"
              onPress={() => setNotice('')}
              style={{
                minWidth: 48,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="close" />
            </Pressable>
          </View>
        </SafeAreaView>
      )}
      <NavigationContainer
        ref={navigation}
        linking={{ prefixes: ['brisa://'], config: { screens: { Chat: 'chat/:conversationId' } } }}
      >
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#d9f0fa' },
            headerTintColor: colors.ink,
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#e8f8ff' },
          }}
        >
          {user && profile ? (
            <Stack.Group navigationKey="authenticated">
              <Stack.Screen
                name="Conversations"
                component={ConversationsScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Users"
                component={UsersScreen}
                options={{ title: 'Nova conversa' }}
              />
              <Stack.Screen
                name="GroupForm"
                component={GroupFormScreen}
                options={{ title: 'Seu grupo' }}
              />
              <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Conversa' }} />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'Perfil' }}
              />
              <Stack.Screen
                name="Members"
                component={MembersScreen}
                options={{ title: 'Integrantes' }}
              />
            </Stack.Group>
          ) : (
            <Stack.Group navigationKey="authentication">
              {!user && (
                <Stack.Screen
                  name="Login"
                  component={LoginScreen}
                  options={{ headerShown: false }}
                />
              )}
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ title: user ? 'Complete seu cadastro' : 'Criar conta' }}
              />
            </Stack.Group>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Routes />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
