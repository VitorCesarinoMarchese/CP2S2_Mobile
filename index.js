import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';
if (Platform.OS !== 'web') {
  const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
  setBackgroundMessageHandler(getMessaging(), async () => {});
}
registerRootComponent(App);
