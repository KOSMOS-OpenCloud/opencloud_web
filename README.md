# OpenCloud Web — KOSMOS Edition

**Web-Client des OpenCore-Stacks (OpenCloud + OpenCosmos).**

OpenCloud Web ist der Browser-Client der KOSMOS Edition:
Dokumenten- und Dateiverwaltung, Volltext- und Semantiksuche,
Metadatenpflege, Online-Office und KI-gestützte Dokumentenverarbeitung.

## Features

- **Dateien**: Upload, Download, Suche, Verwaltung
- **Teilen**: fein-granularer Zugriff auf Dateien und Ordner
- **Links**: Teilen mit Passwort-Schutz
- **Online-Office**: Collabora-Integration (WOPI)
- **Spaces**: projektbezogene Datenbereiche
- **Versionierung**: Zeitmaschine für Dateiversionen
- **Drop-Folder**: Dateisammlung über Links
- **Suche**: Volltext (Bleve) + Semantik (Qdrant) mit KI-Metadaten
- **Metadaten**: Aktenzeichen, Favoriten, Tags
- **KI-Dokumentenverarbeitung**: OCR, Zusammenfassung, Klassifikation
  (via open_taki)
- **Erweiterbar**: Web-Extension-Ökosystem (Vue.js, Module Federation)
- **Responsive**: Desktop und Mobile
- **Darkmode** und **Themes**

## Repository-Struktur

- **client:** TypeScript-Client für die OpenCore-APIs
- **container:** Statische Assets und Basis-Dateien
- **extension-sdk:** Utilities für Extensions
- **pkg:** Gemeinsame Logik
- **runtime:** Auth, Layout, Routing, Theming, Sub-Apps

Apps (via `config.json` ein-/ausschaltbar):

- **files** — Dateiverwaltung (Kern)
- **search** — Suchprovider (Volltext + Semantik)
- **admin-settings** — Verwaltung von Nutzern, Gruppen, Spaces
- **activities** — Aktivitäts-Stream
- **preview** — Audio, Video, Bild
- **pdf-viewer** — PDF-Ansicht
- **text-editor** — Textdateien
- **epub-reader** — E-Books
- **external** — WOPI (Online-Office)
- **app-store** — Extensions-Verwaltung
- **webfinger** — Webfinger-Redirect

## Build

``` console
pnpm install
pnpm build
```

Für das OpenCore-Build (ZIP-Extension) siehe `build_web.sh`.

## License

[AGPL-3.0-or-later](LICENSE)
