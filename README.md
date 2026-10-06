# XCells

A mobile spreadsheet viewer for iOS and Android, built with Expo (React Native) and SheetJS.

## What it does

- Opens XLSX, XLSM, XLSB, XLS, CSV, TSV and ODS files from the device's file picker
- Shows the file in a scrollable grid with column letters (sticky) and row numbers
- Switches between sheets with tabs along the bottom
- Tap a cell to see its full value, or its formula, in the bar at the top
- Find text in the current sheet, and zoom text with A− / A+
- Registers XCells for spreadsheet files, so "Open in" / "Open with" from Files, Mail or Drive works (needs an installed build, not Expo Go)

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone to try it. `npm run web` also works for a quick look in a browser.

## Build installable apps

```bash
npx eas-cli@latest build --platform ios       # or android, or all
```

Bundle ID / package name: `com.superduty335.xcells` (change in `app.json` if you want a different one).

## Layout

- `App.tsx` – home screen, viewer screen, toolbar, find, sheet tabs
- `src/SheetGrid.tsx` – virtualized grid
- `src/workbook.ts` – SheetJS parsing into display rows, column widths, formulas
- `src/openFile.ts` – file picker and "Open in" handling
- `assets/` – app icons generated from the XCells logo

SheetJS is installed from its official CDN (`cdn.sheetjs.com`), since the copy on npm is outdated and has known security issues.
