#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?Set ANDROID_HOME to the Android SDK directory.}"
: "${JAVA_HOME:?Set JAVA_HOME to a JDK 17 installation.}"
test -f google-services.json || { echo 'Missing google-services.json'; exit 1; }
test -f .env || { echo 'Copy .env.example to .env and configure EXPO_PUBLIC_API_URL.'; exit 1; }

npx expo prebuild --platform android --no-install
(
  cd android
  ./gradlew app:assembleRelease -x lint -x test --build-cache --max-workers=2 \
    -PreactNativeArchitectures=arm64-v8a,x86_64
)
mkdir -p artifacts
cp android/app/build/outputs/apk/release/app-release.apk artifacts/brisa-android.apk
sha256sum artifacts/brisa-android.apk
