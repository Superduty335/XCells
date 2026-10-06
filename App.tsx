import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { isFileUrl, loadFromUrl, pickSpreadsheet, type LoadedFile } from './src/openFile';
import { SheetGrid, type Selection, type SheetGridHandle } from './src/SheetGrid';
import { cellAddress, cellContents, parseWorkbook, type Workbook } from './src/workbook';

const GREEN = '#107C41';

export default function App() {
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (load: () => Promise<LoadedFile | null>) => {
    setLoading(true);
    try {
      const file = await load();
      if (!file) return;
      // Let the spinner paint before the synchronous parse blocks the JS thread.
      await new Promise((resolve) => setTimeout(resolve, 30));
      const wb = parseWorkbook(file.data, file.name);
      if (wb.sheets.length === 0) throw new Error('No sheets found in this file.');
      setWorkbook(wb);
    } catch (e) {
      Alert.alert("Couldn't open file", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Files opened from another app ("Open in XCells").
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (isFileUrl(url)) open(() => loadFromUrl(url));
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isFileUrl(url)) open(() => loadFromUrl(url));
    });
    return () => sub.remove();
  }, [open]);

  return (
    <SafeAreaProvider>
      <StatusBar style={workbook ? 'light' : 'dark'} />
      {workbook ? (
        <Viewer workbook={workbook} onClose={() => setWorkbook(null)} />
      ) : (
        <Home onOpen={() => open(pickSpreadsheet)} />
      )}
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Opening…</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

function Home({ onOpen }: { onOpen: () => void }) {
  return (
    <SafeAreaView style={styles.home}>
      <Image source={require('./assets/icon.png')} style={styles.logo} />
      <Text style={styles.title}>XCells</Text>
      <Text style={styles.subtitle}>View Excel and CSV spreadsheets on the go.</Text>
      <Pressable style={({ pressed }) => [styles.openButton, pressed && styles.pressed]} onPress={onOpen}>
        <Text style={styles.openButtonText}>Open spreadsheet</Text>
      </Pressable>
      <Text style={styles.formats}>XLSX · XLSM · XLSB · XLS · CSV · TSV · ODS</Text>
    </SafeAreaView>
  );
}

function Viewer({ workbook, onClose }: { workbook: Workbook; onClose: () => void }) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [zoom, setZoom] = useState(1);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const gridRef = useRef<SheetGridHandle>(null);
  const sheet = workbook.sheets[sheetIndex];

  const select = useCallback((r: number, c: number) => setSelection({ r, c }), []);

  const switchSheet = (i: number) => {
    setSheetIndex(i);
    setSelection(null);
  };

  const findNext = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const rows = sheet.rows;
    const cols = rows[0]?.length ?? 0;
    const total = rows.length * cols;
    const start = selection ? selection.r * cols + selection.c + 1 : 0;
    for (let i = 0; i < total; i++) {
      const pos = (start + i) % total;
      const r = Math.floor(pos / cols);
      const c = pos % cols;
      if (rows[r][c].toLowerCase().includes(q)) {
        setSelection({ r, c });
        gridRef.current?.scrollToCell(r, c);
        return;
      }
    }
    Alert.alert('Not found', `No cells in "${sheet.name}" contain "${query.trim()}".`);
  };

  return (
    <SafeAreaView style={styles.viewer} edges={['top', 'left', 'right']}>
      <View style={styles.toolbar}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.toolbarButton}>‹ Files</Text>
        </Pressable>
        <Text style={styles.fileName} numberOfLines={1}>
          {workbook.fileName}
        </Text>
        <Pressable onPress={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} hitSlop={6}>
          <Text style={styles.toolbarButton}>A−</Text>
        </Pressable>
        <Pressable onPress={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(1)))} hitSlop={6}>
          <Text style={styles.toolbarButton}>A+</Text>
        </Pressable>
        <Pressable onPress={() => setSearching((s) => !s)} hitSlop={6}>
          <Text style={styles.toolbarButton}>{searching ? 'Done' : 'Find'}</Text>
        </Pressable>
      </View>

      {searching && (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder={`Find in ${sheet.name}`}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={findNext}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            submitBehavior="submit"
          />
          <Pressable onPress={findNext} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Next</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.formulaBar}>
        <Text style={styles.address}>{selection ? cellAddress(sheet, selection.r, selection.c) : ''}</Text>
        <Text style={styles.formula} numberOfLines={3} selectable>
          {selection ? cellContents(sheet, selection.r, selection.c) : 'Tap a cell to see its contents'}
        </Text>
      </View>

      {sheet.truncated && (
        <Text style={styles.notice}>This sheet is very large, so only the first {sheet.rows.length.toLocaleString()} rows are shown.</Text>
      )}

      <View style={styles.grid}>
        <SheetGrid
          key={sheetIndex}
          ref={gridRef}
          sheet={sheet}
          zoom={zoom}
          selection={selection}
          onSelect={select}
        />
      </View>

      <SafeAreaView edges={['bottom']} style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {workbook.sheets.map((s, i) => (
            <Pressable key={i} onPress={() => switchSheet(i)} style={[styles.tab, i === sheetIndex && styles.tabActive]}>
              <Text style={[styles.tabText, i === sheetIndex && styles.tabTextActive]} numberOfLines={1}>
                {s.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flex: 1, backgroundColor: '#FFFFFF' },
  home: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F6F8F7' },
  logo: { width: 132, height: 132, borderRadius: 30, marginBottom: 20 },
  title: { fontSize: 34, fontWeight: '800', color: '#0B3D22' },
  subtitle: { fontSize: 16, color: '#4D5B54', marginTop: 6, textAlign: 'center' },
  openButton: {
    marginTop: 36,
    backgroundColor: GREEN,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
  },
  pressed: { opacity: 0.8 },
  openButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  formats: { marginTop: 18, color: '#7A8781', fontSize: 13, letterSpacing: 0.5 },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: '#FFFFFF', marginTop: 12, fontSize: 16 },
  viewer: { flex: 1, backgroundColor: GREEN },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: GREEN,
  },
  toolbarButton: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  fileName: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  searchBar: { flexDirection: 'row', gap: 8, padding: 8, backgroundColor: '#0C6634' },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
  },
  searchButton: { justifyContent: 'center', paddingHorizontal: 12 },
  searchButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  formulaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#D9DEE3',
  },
  address: { width: 64, fontWeight: '700', color: GREEN, fontSize: 14 },
  formula: { flex: 1, color: '#1F2328', fontSize: 14 },
  notice: { backgroundColor: '#FFF4CE', color: '#5C4A00', paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  tabsWrap: { backgroundColor: '#F3F5F7', borderTopWidth: 1, borderColor: '#D9DEE3' },
  tabs: { paddingHorizontal: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 11, maxWidth: 200, borderBottomWidth: 3, borderColor: 'transparent' },
  tabActive: { backgroundColor: '#FFFFFF', borderColor: GREEN },
  tabText: { color: '#5B6670', fontSize: 14 },
  tabTextActive: { color: GREEN, fontWeight: '700' },
});
