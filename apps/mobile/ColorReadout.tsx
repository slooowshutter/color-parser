import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLOR_FORMATS, formatColor } from '../../lib/format-color';
import type { ColorObject } from '../../lib/types';
import { theme } from './theme';

export function ColorReadout({ color }: { color: ColorObject }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hex = formatColor(color, 'hex');

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copy(value: string, label: string) {
    try {
      await Clipboard.setStringAsync(value);
      setCopied(label);
      setCopyError(false);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={[styles.swatch, { backgroundColor: hex }]} />
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>YOUR COLOR</Text>
          <Text selectable style={styles.hex}>{hex.toUpperCase()}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy color in every format"
          onPress={() => void copy(COLOR_FORMATS.map((format) => formatColor(color, format)).join('\n'), 'all')}
          style={({ pressed }) => [styles.copyAll, pressed && styles.pressed]}
        >
          <Text style={styles.copyAllText}>{copied === 'all' ? 'Copied' : 'Copy all'}</Text>
        </Pressable>
      </View>

      {color.outOfGamut ? <Text style={styles.note}>Preview and RGB formats are clipped to sRGB. Wide gamut formats retain the color.</Text> : null}

      {COLOR_FORMATS.map((format) => {
        const value = formatColor(color, format);
        return (
          <Pressable
            key={format}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${format.toUpperCase()}: ${value}`}
            onPress={() => void copy(value, format)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.label}>{format.toUpperCase()}</Text>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.copy}>{copied === format ? '✓' : '↗'}</Text>
          </Pressable>
        );
      })}
      <Text accessibilityLiveRegion="polite" style={styles.footer}>
        {copyError ? 'Could not copy. Press and hold the HEX value to select it.' : copied ? 'Copied to your clipboard.' : 'Tap a format to copy it.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.surface, borderRadius: 24, padding: 18, gap: 2 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headingText: { flex: 1 },
  swatch: { width: 48, height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#00000016' },
  eyebrow: { color: theme.secondary, fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  hex: { color: theme.ink, fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 4 },
  copyAll: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: theme.accent, justifyContent: 'center' },
  copyAllText: { color: theme.ink, fontSize: 12, fontWeight: '700' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#EDEFE8', paddingVertical: 10 },
  label: { width: 48, fontSize: 11, fontWeight: '700', color: theme.secondary },
  value: { flex: 1, fontFamily: 'Menlo', color: theme.ink, fontSize: 12, lineHeight: 19 },
  copy: { color: theme.secondary, width: 18, fontSize: 19, textAlign: 'center' },
  footer: { color: theme.secondary, fontSize: 11, marginTop: 12, minHeight: 16 },
  note: { color: theme.secondary, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  pressed: { opacity: 0.62 },
});
