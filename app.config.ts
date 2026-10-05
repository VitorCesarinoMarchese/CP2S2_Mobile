import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'Brisa',
  slug: 'brisa-chat',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'brisa',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.brisa.chat',
    supportsTablet: true,
    googleServicesFile: './GoogleService-Info.plist',
    entitlements: { 'aps-environment': 'production' },
    infoPlist: { UIBackgroundModes: ['remote-notification'] },
  },
  android: {
    package: 'com.brisa.chat',
    googleServicesFile: './google-services.json',
    permissions: ['POST_NOTIFICATIONS'],
  },
  plugins: [
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    'expo-dev-client',
    ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
    [
      'expo-image-picker',
      {
        photosPermission:
          'A Brisa precisa acessar suas fotos para escolher uma imagem de perfil ou grupo.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    ['expo-notifications', { color: '#087f9b', defaultChannel: 'messages' }],
  ],
  web: { bundler: 'metro', name: 'Brisa Chat' },
};
export default config;
