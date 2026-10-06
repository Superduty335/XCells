import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export type LoadedFile = { name: string; data: ArrayBuffer };

const MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'text/comma-separated-values',
  'text/tab-separated-values',
];

export async function pickSpreadsheet(): Promise<LoadedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Android file providers often report CSV and XLS under generic types, so allow everything there.
    type: Platform.OS === 'android' ? '*/*' : MIME_TYPES,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const data = asset.file ? await asset.file.arrayBuffer() : await new File(asset.uri).arrayBuffer();
  return { name: asset.name, data };
}

// Files handed to the app via "Open in XCells" / "Open with" arrive as a file:// or content:// URL.
export function isFileUrl(url: string | null): url is string {
  return !!url && (url.startsWith('file://') || url.startsWith('content://'));
}

export async function loadFromUrl(url: string): Promise<LoadedFile> {
  const data = await new File(url).arrayBuffer();
  const last = url.split('?')[0].split('/').pop() ?? '';
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {}
  name = name.split('/').pop() ?? name;
  if (!name.includes('.')) name = 'Spreadsheet';
  return { name, data };
}
