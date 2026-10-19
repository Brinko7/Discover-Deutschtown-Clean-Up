#!/usr/bin/env bash
# Build a sideloadable debug APK of the latest code. Nothing is published.
# Usage: npm run apk            (output: dist-test/MindYourBlock-debug.apk)
#        npm run apk -- --install   (also adb-install to a USB-connected phone)
set -euo pipefail
cd "$(dirname "$0")/.."

# Gradle 8.14 needs JDK 17-24; Android Studio's bundled JDK 25 is too new.
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

[ -d node_modules ] || npm install
npm run sync
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

(cd android && ./gradlew assembleDebug)

mkdir -p dist-test
cp android/app/build/outputs/apk/debug/app-debug.apk dist-test/MindYourBlock-debug.apk
echo "APK: $(pwd)/dist-test/MindYourBlock-debug.apk"

if [ "${1:-}" = "--install" ]; then
  adb install -r dist-test/MindYourBlock-debug.apk
fi
