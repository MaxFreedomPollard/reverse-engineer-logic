#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT_DIR/build/macos}"
DIST_DIR="${DIST_DIR:-$ROOT_DIR/dist-release}"
APP_NAME="Reverse Engineer Logic.app"
APP_BUNDLE="$BUILD_DIR/$APP_NAME"
VERSION="1.0.0"

rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR/arm64" "$BUILD_DIR/x86_64" "$DIST_DIR"

echo "1. Bundling embedded JavaScriptCore epistemic engine..."
node "$SCRIPT_DIR/scripts/bundle-jsc-core.mjs"

echo "2. Rendering AppIcon.icns..."
ICONSET_DIR="$BUILD_DIR/AppIcon.iconset"
swift "$SCRIPT_DIR/scripts/generate_icon.swift" "$ICONSET_DIR"
iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/AppIcon.icns"

echo "3. Compiling Universal (arm64 + x86_64) macOS GUI executable..."
SDK_PATH="$(xcrun --sdk macosx --show-sdk-path)"
for ARCH in arm64 x86_64; do
  swiftc -O \
    -sdk "$SDK_PATH" \
    -target "${ARCH}-apple-macos13.0" \
    "$SCRIPT_DIR/Sources/RelEngineBridge.swift" \
    "$SCRIPT_DIR/Sources/RelMacAppMain.swift" \
    -framework AppKit -framework WebKit -framework JavaScriptCore -framework CryptoKit -framework Security \
    -o "$BUILD_DIR/$ARCH/ReverseEngineerLogic"

  swiftc -O \
    -sdk "$SDK_PATH" \
    -target "${ARCH}-apple-macos13.0" \
    -parse-as-library \
    "$SCRIPT_DIR/Sources/RelEngineBridge.swift" \
    "$SCRIPT_DIR/Sources/RelCliMain.swift" \
    -framework Foundation -framework JavaScriptCore -framework CryptoKit -framework Security \
    -o "$BUILD_DIR/$ARCH/rel"
done

mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"
lipo -create "$BUILD_DIR/arm64/ReverseEngineerLogic" "$BUILD_DIR/x86_64/ReverseEngineerLogic" \
  -output "$APP_BUNDLE/Contents/MacOS/ReverseEngineerLogic"
lipo -create "$BUILD_DIR/arm64/rel" "$BUILD_DIR/x86_64/rel" \
  -output "$APP_BUNDLE/Contents/MacOS/rel"
chmod +x "$APP_BUNDLE/Contents/MacOS/ReverseEngineerLogic" "$APP_BUNDLE/Contents/MacOS/rel"

cp "$SCRIPT_DIR/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
cp "$BUILD_DIR/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
cp "$SCRIPT_DIR/Resources/rel-jsc-core.js" "$APP_BUNDLE/Contents/Resources/rel-jsc-core.js"
cp "$ROOT_DIR/skills/reverse-engineer-logic/SKILL.md" "$APP_BUNDLE/Contents/Resources/SKILL.md"

SIGN_ID="${CODESIGN_IDENTITY:--}"
echo "4. Signing app bundle (identity: $SIGN_ID)..."
if [ "$SIGN_ID" = "-" ]; then
  codesign --force --sign - "$APP_BUNDLE/Contents/MacOS/rel"
  codesign --force --sign - "$APP_BUNDLE/Contents/MacOS/ReverseEngineerLogic"
  codesign --force --deep --sign - "$APP_BUNDLE"
else
  codesign --force --options runtime --timestamp --sign "$SIGN_ID" "$APP_BUNDLE/Contents/MacOS/rel"
  codesign --force --options runtime --timestamp --sign "$SIGN_ID" "$APP_BUNDLE/Contents/MacOS/ReverseEngineerLogic"
  codesign --force --options runtime --timestamp --sign "$SIGN_ID" "$APP_BUNDLE"
fi

ZIP_NAME="Reverse-Engineer-Logic-${VERSION}-macOS-Universal.zip"
DMG_NAME="Reverse-Engineer-Logic-${VERSION}-macOS-Universal.dmg"

echo "5. Creating distribution ZIP & DMG..."
ditto -c -k --keepParent "$APP_BUNDLE" "$DIST_DIR/$ZIP_NAME"

DMG_STAGE="$BUILD_DIR/dmg-stage"
mkdir -p "$DMG_STAGE"
cp -R "$APP_BUNDLE" "$DMG_STAGE/"
ln -s /Applications "$DMG_STAGE/Applications"
hdiutil create -volname "Reverse Engineer Logic" -srcfolder "$DMG_STAGE" -ov -format UDZO "$DIST_DIR/$DMG_NAME" >/dev/null

if [ "$SIGN_ID" != "-" ]; then
  codesign --force --timestamp --sign "$SIGN_ID" "$DIST_DIR/$DMG_NAME"
fi

(cd "$DIST_DIR" && shasum -a 256 "$DMG_NAME" "$ZIP_NAME" > SHA256SUMS.txt)
echo "Built artifacts in $DIST_DIR:"
ls -lh "$DIST_DIR"
