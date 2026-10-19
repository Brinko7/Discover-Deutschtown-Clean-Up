#!/usr/bin/env bash
# Build the latest code and install it on a USB-connected iPhone (or open Xcode).
# Works with a free Apple ID (app expires after 7 days; reinstall to refresh).
# Usage: npm run ios          (syncs, then opens Xcode; pick your phone, press Run)
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d node_modules ] || npm install
npm run sync
npx cap open ios
echo "In Xcode: App target > Signing & Capabilities > pick your Personal Team,"
echo "choose your iPhone at the top, press Run. First time: on the phone enable"
echo "Settings > Privacy & Security > Developer Mode, and trust the developer"
echo "profile under Settings > General > VPN & Device Management."
