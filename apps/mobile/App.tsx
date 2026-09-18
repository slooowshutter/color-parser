import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { parseColors } from '../../lib/build-color-object';
import { formatColor } from '../../lib/format-color';
import type { ColorObject } from '../../lib/types';
import { ColorReadout } from './ColorReadout';
import { PhotoSampler, type PixelSample } from './PhotoSampler';
import { preparePhoto, releasePhoto, type SamplingPhoto } from './photo';
import { theme } from './theme';

export default function App() {
  return <SafeAreaProvider><ColorLab /></SafeAreaProvider>;
}

function ColorLab() {
  const [mode, setMode] = useState<'photo' | 'text'>('photo');
  const [photo, setPhoto] = useState<SamplingPhoto | null>(null);
  const [sample, setSample] = useState<ColorObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('oklch(72% 0.18 145)\n#FF7759\nrgb(28 64 55 / 80%)');
  const [colors, setColors] = useState<ColorObject[]>([]);
  const [parsed, setParsed] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = mode === 'photo' ? sample : colors[selectedIndex];

  useEffect(() => () => {
    if (photo) void releasePhoto(photo.uri).catch(() => undefined);
  }, [photo]);

  const handleSample = useCallback(({ r, g, b, alpha }: PixelSample) => {
    setSample(parseColors(`rgb(${r} ${g} ${b} / ${alpha})`)[0] ?? null);
  }, []);

  async function pickPhoto(source: 'camera' | 'library') {
    setError(null);
    setLoading(true);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera access is off', 'Allow camera access in Settings, or choose a photo from your library.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ]);
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets[0]) {
        const prepared = await preparePhoto(result.assets[0]);
        setSample(null);
        setPhoto(prepared);
      }
    } catch {
      setError(source === 'camera'
        ? 'Could not open the camera or read the photo. Try choosing an image from Photos.'
        : 'Could not open that photo. Try a different image.');
    } finally {
      setLoading(false);
    }
  }

  function parseInput() {
    Keyboard.dismiss();
    setColors(parseColors(input));
    setSelectedIndex(0);
    setParsed(true);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} canCancelContentTouches={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brandDot} />
          <Text style={styles.brand}>color studio</Text>
          <Text style={styles.deviceBadge}>POCKET STUDIO</Text>
        </View>
        <View style={styles.intro}>
          <Text style={styles.title}>A little closer.{"\n"}A lot more color.</Text>
          <Text style={styles.subtitle}>Find a color in your world. Take it everywhere.</Text>
        </View>

        <View style={styles.tabs}>
          {(['photo', 'text'] as const).map((tab) => (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === tab }}
              onPress={() => setMode(tab)}
              style={[styles.tab, mode === tab && styles.tabActive]}
            ><Text style={[styles.tabText, mode === tab && styles.tabTextActive]}>{tab === 'photo' ? 'Pick from a photo' : 'Parse any color'}</Text></Pressable>
          ))}
        </View>

        {mode === 'photo' ? (
          <View style={styles.section}>
            <View style={styles.photoActions}>
              <Pressable accessibilityRole="button" disabled={loading} onPress={() => void pickPhoto('camera')} style={({ pressed }) => [styles.primaryButton, styles.flex, (pressed || loading) && styles.pressed]}>
                <Text style={styles.primaryText}>Take a photo</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={loading} onPress={() => void pickPhoto('library')} style={({ pressed }) => [styles.secondaryButton, styles.flex, (pressed || loading) && styles.pressed]}>
                <Text style={styles.secondaryText}>Choose photo</Text>
              </Pressable>
            </View>
            {loading ? <View style={styles.loading}><ActivityIndicator color={theme.ink} /><Text style={styles.help}>Preparing your photo…</Text></View> : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {photo ? (
              <PhotoSampler key={photo.uri} photo={photo} onSample={handleSample} />
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyArtwork}>
                  <View style={[styles.artSwatch, styles.artSwatchBack]} />
                  <View style={[styles.artSwatch, styles.artSwatchFront]} />
                  <View style={styles.artLoupe}><View style={styles.artPixel} /></View>
                </View>
                <Text style={styles.emptyTitle}>Your world, one pixel at a time.</Text>
                <Text style={styles.emptyText}>Open a photo, then drag the magnifier to find exactly the color you came for.</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.inputLabel}>A color, some CSS, or an entire palette.</Text>
            <TextInput
              accessibilityLabel="Color text to parse"
              value={input}
              onChangeText={(value) => { setInput(value); setParsed(false); setColors([]); }}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              maxLength={100000}
              placeholder="Paste HEX, RGB, HSL, OKLCH…"
              placeholderTextColor={theme.secondary}
              style={styles.input}
            />
            <Pressable accessibilityRole="button" onPress={parseInput} disabled={!input.trim()} style={({ pressed }) => [styles.primaryButton, (pressed || !input.trim()) && styles.pressed]}>
              <Text style={styles.primaryText}>Find colors</Text>
            </Pressable>
            {parsed ? <Text accessibilityLiveRegion="polite" style={styles.help}>{colors.length ? `${colors.length} ${colors.length === 1 ? 'color' : 'colors'} found. Select one to see its formats.` : 'No supported colors found. Try #FF7759 or oklch(72% 0.18 145).'}</Text> : null}
            {colors.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.palette}>
                {colors.slice(0, 300).map((color, index) => (
                  <Pressable
                    key={`${color.token.startPosition}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Select color ${index + 1}, ${color.token.raw}`}
                    accessibilityState={{ selected: selectedIndex === index }}
                    onPress={() => setSelectedIndex(index)}
                    style={[styles.paletteColor, { backgroundColor: formatColor(color, 'hex') }, selectedIndex === index && styles.paletteSelected]}
                  />
                ))}
              </ScrollView>
            ) : null}
            {colors.length > 300 ? <Text style={styles.help}>Showing the first 300 colors. Paste a smaller selection to explore the rest.</Text> : null}
          </View>
        )}

        {selected ? <ColorReadout color={selected} /> : null}
        <View style={styles.privacy}>
          <Text style={styles.privacyTitle}>Made to stay with you.</Text>
          <Text style={styles.help}>Your photos and color text are processed on your device.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  content: { padding: 22, paddingBottom: 48, gap: 24, maxWidth: 620, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot: { width: 15, height: 15, borderRadius: 5, backgroundColor: theme.ink },
  brand: { color: theme.ink, fontWeight: '800', fontSize: 21, letterSpacing: -0.6 },
  deviceBadge: { marginLeft: 'auto', color: theme.secondary, fontSize: 8, letterSpacing: 1.3, fontWeight: '700' },
  intro: { gap: 10, marginTop: 12 },
  title: { color: theme.ink, fontSize: 36, lineHeight: 39, fontWeight: '700', letterSpacing: -1.3 },
  subtitle: { color: theme.secondary, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: 'row', backgroundColor: '#E7EAE0', padding: 4, borderRadius: 17, gap: 4 },
  tab: { flex: 1, minHeight: 46, justifyContent: 'center', alignItems: 'center', borderRadius: 13, paddingHorizontal: 8 },
  tabActive: { backgroundColor: theme.surface },
  tabText: { color: theme.secondary, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: theme.ink },
  section: { gap: 14 },
  photoActions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primaryButton: { minHeight: 50, backgroundColor: theme.ink, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryText: { color: 'white', fontWeight: '600', fontSize: 13 },
  secondaryButton: { minHeight: 50, backgroundColor: theme.accent, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryText: { color: theme.ink, fontWeight: '600', fontSize: 13 },
  loading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  help: { color: theme.secondary, fontSize: 12, lineHeight: 18 },
  error: { color: theme.error, fontSize: 13, lineHeight: 19 },
  empty: { minHeight: 315, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed', borderRadius: 24, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyArtwork: { height: 106, width: 145, marginBottom: 12 },
  artSwatch: { position: 'absolute', width: 68, height: 84, borderRadius: 14 },
  artSwatchBack: { left: 11, top: 8, backgroundColor: '#FF967B', transform: [{ rotate: '-15deg' }] },
  artSwatchFront: { left: 64, top: 17, backgroundColor: theme.accent, transform: [{ rotate: '14deg' }] },
  artLoupe: { width: 62, height: 62, borderRadius: 31, borderWidth: 7, borderColor: theme.ink, position: 'absolute', left: 38, top: 29, backgroundColor: '#D2DC97', alignItems: 'center', justifyContent: 'center' },
  artPixel: { width: 12, height: 12, borderWidth: 2, borderColor: theme.ink },
  emptyTitle: { color: theme.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyText: { color: theme.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  inputLabel: { color: theme.ink, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 158, backgroundColor: theme.surface, padding: 17, borderRadius: 18, fontFamily: 'Menlo', fontSize: 14, lineHeight: 24, color: theme.ink, textAlignVertical: 'top', borderColor: theme.border, borderWidth: 1 },
  palette: { gap: 10, padding: 3 },
  paletteColor: { width: 48, height: 48, borderRadius: 15, borderColor: '#00000016', borderWidth: 1 },
  paletteSelected: { borderWidth: 3, borderColor: theme.ink },
  privacy: { gap: 5, alignItems: 'center' },
  privacyTitle: { color: theme.ink, fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
