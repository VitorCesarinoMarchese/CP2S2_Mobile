const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNotificationMetadata(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    for (const entry of manifest.application?.[0]?.['meta-data'] ?? []) {
      const name = entry.$['android:name'];
      if (name === 'com.google.firebase.messaging.default_notification_channel_id') {
        entry.$['tools:replace'] = 'android:value';
      }
      if (name === 'com.google.firebase.messaging.default_notification_color') {
        entry.$['tools:replace'] = 'android:resource';
      }
    }
    return androidConfig;
  });
};
