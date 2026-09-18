#!/bin/sh
set -eu
native_test_binary=$(mktemp -t color-lab-native-tests)
trap 'rm -f "$native_test_binary"' EXIT
xcrun swiftc modules/color-image/ios/ColorImageNormalizer.swift tests/ColorImageNormalizerTests.swift -o "$native_test_binary"
"$native_test_binary"
