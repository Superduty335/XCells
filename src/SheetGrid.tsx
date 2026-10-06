import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { columnName, type Sheet } from './workbook';

export type Selection = { r: number; c: number } | null;

export type SheetGridHandle = {
  scrollToCell: (r: number, c: number) => void;
};

type Props = {
  sheet: Sheet;
  zoom: number;
  selection: Selection;
  onSelect: (r: number, c: number) => void;
};

const BASE_ROW_HEIGHT = 30;
const BASE_FONT = 13;

export const SheetGrid = forwardRef<SheetGridHandle, Props>(function SheetGrid(
  { sheet, zoom, selection, onSelect },
  ref,
) {
  const rowHeight = Math.round(BASE_ROW_HEIGHT * zoom);
  const fontSize = BASE_FONT * zoom;
  const gutter = Math.round(Math.max(40, String(sheet.rows.length + sheet.rowOffset).length * 9 + 16) * zoom);
  const widths = useMemo(() => sheet.colWidths.map((w) => Math.round(w * zoom)), [sheet, zoom]);
  const offsets = useMemo(() => {
    const out: number[] = [];
    let x = gutter;
    for (const w of widths) {
      out.push(x);
      x += w;
    }
    out.push(x);
    return out;
  }, [widths, gutter]);
  const totalWidth = offsets[offsets.length - 1];

  const listRef = useRef<FlatList<string[]>>(null);
  const hScrollRef = useRef<ScrollView>(null);

  useImperativeHandle(ref, () => ({
    scrollToCell(r, c) {
      listRef.current?.scrollToIndex({ index: r, viewPosition: 0.4, animated: true });
      hScrollRef.current?.scrollTo({ x: Math.max(0, offsets[c] - gutter - 40), animated: true });
    },
  }));

  const renderItem = useCallback(
    ({ item, index }: { item: string[]; index: number }) => (
      <Row
        cells={item}
        numeric={sheet.numeric[index]}
        rowIndex={index}
        label={index + sheet.rowOffset + 1}
        widths={widths}
        gutter={gutter}
        height={rowHeight}
        fontSize={fontSize}
        selectedCol={selection?.r === index ? selection.c : -1}
        onSelect={onSelect}
      />
    ),
    [sheet, widths, gutter, rowHeight, fontSize, selection, onSelect],
  );

  const header = (
    <View style={[styles.row, styles.headerRow, { height: rowHeight }]}>
      <View style={[styles.corner, { width: gutter }]} />
      {widths.map((w, c) => (
        <View
          key={c}
          style={[styles.headerCell, { width: w }, selection?.c === c && styles.headerCellActive]}
        >
          <Text style={[styles.headerText, { fontSize: fontSize * 0.9 }]} numberOfLines={1}>
            {columnName(c + sheet.colOffset)}
          </Text>
        </View>
      ))}
    </View>
  );

  if (sheet.rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>This sheet is empty.</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={hScrollRef} horizontal bounces={false} style={styles.flex}>
      <FlatList
        ref={listRef}
        style={{ width: totalWidth }}
        data={sheet.rows}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={header}
        stickyHeaderIndices={[0]}
        getItemLayout={(_, index) => ({ length: rowHeight, offset: rowHeight * (index + 1), index })}
        initialNumToRender={40}
        maxToRenderPerBatch={40}
        windowSize={11}
        extraData={selection}
      />
    </ScrollView>
  );
});

type RowProps = {
  cells: string[];
  numeric: Uint8Array;
  rowIndex: number;
  label: number;
  widths: number[];
  gutter: number;
  height: number;
  fontSize: number;
  selectedCol: number;
  onSelect: (r: number, c: number) => void;
};

const Row = memo(function Row({
  cells,
  numeric,
  rowIndex,
  label,
  widths,
  gutter,
  height,
  fontSize,
  selectedCol,
  onSelect,
}: RowProps) {
  return (
    <View style={[styles.row, { height }]}>
      <View style={[styles.gutter, { width: gutter }, selectedCol >= 0 && styles.headerCellActive]}>
        <Text style={[styles.headerText, { fontSize: fontSize * 0.9 }]}>{label}</Text>
      </View>
      {cells.map((value, c) => (
        <Pressable
          key={c}
          onPress={() => onSelect(rowIndex, c)}
          style={[styles.cell, { width: widths[c] }, c === selectedCol && styles.cellSelected]}
        >
          <Text
            style={[styles.cellText, { fontSize, textAlign: numeric[c] ? 'right' : 'left' }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        </Pressable>
      ))}
    </View>
  );
});

const GRID = '#D9DEE3';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', backgroundColor: '#FFFFFF' },
  headerRow: { backgroundColor: '#F3F5F7' },
  corner: { backgroundColor: '#E8EBEE', borderRightWidth: 1, borderBottomWidth: 1, borderColor: GRID },
  headerCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 1,
    borderColor: GRID,
    backgroundColor: '#F3F5F7',
    overflow: 'hidden',
  },
  headerCellActive: { backgroundColor: '#D3EEDC' },
  headerText: { color: '#5B6670', fontWeight: '600' },
  gutter: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F5F7',
    borderRightWidth: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: GRID,
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: GRID,
    overflow: 'hidden',
  },
  cellSelected: { borderWidth: 2, borderColor: '#107C41', paddingHorizontal: 4.5 },
  cellText: { color: '#1F2328' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6B7680', fontSize: 15 },
});
