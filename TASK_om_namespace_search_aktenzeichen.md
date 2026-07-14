# TASK: om: Namespace + Aktenzeichen in Suchergebnissen

## Zusammenfassung

Einführung eines eigenen WebDAV-Namespace `om:` (opencloud metadata) für Custom-Metadaten,
sowie Anzeige von Aktenzeichen in Suchergebnissen (Quickview + Ergebnisliste) —
sowohl am Item als auch am Parent-Folder.

## Hintergrund

### Aktueller Zustand

- Custom-Metadaten laufen über `ArbitraryMetadata` in reva
- `registerExtraProp('aktencode')` im Web-UI erzeugt `<aktencode xmlns="http://owncloud.org/ns"/>`
- reva `requiresExplicitFetching()` hat eine statische Whitelist im `oc:` Namespace —
  unbekannte Props wie `aktencode` werden **nicht abgefragt** (return false)
- `metadataKeyOf()` baut den vollen Namespace-URL als Key:
  `"http://owncloud.org/ns/aktencode"` → xattr `user.oc.md.http://owncloud.org/ns/aktencode`
- Parent-Folder-Metadaten werden bei der Suche nicht mitgeliefert —
  `parentFolderName` wird nur aus `resource.path` geparsed

### Was existiert

- Alle `user.oc.md.*` xattrs sind eigener Code (openyard `md.oy.*`, folderviews `md.*`)
- Keine Drittanbieter-Daten, kein Legacy das brechen könnte
- `libre.graph.*` Props (audio, image, photo) haben eigene Codepfade, nicht betroffen
- `favorite`, `tags`, `share-types` haben eigene Handler, nicht betroffen

---

## Änderungen

### 1. reva — Neuer `om:` Namespace (propfind.go)

**Datei:** `internal/http/services/owncloud/ocdav/propfind/propfind.go`

#### 1.1 Namespace-Konstante

```go
// net/net.go
const NsOwncloudMetadata = "http://owncloud.org/ns/metadata"
```

#### 1.2 `requiresExplicitFetching()` — om: immer abfragen

```go
func requiresExplicitFetching(n *xml.Name) bool {
    switch n.Space {
    case net.NsOwncloudMetadata:
        return true  // Custom-Metadaten immer abfragen
    case net.NsDav:
        // ... unverändert
    case net.NsOwncloud:
        // ... bestehende Whitelist unverändert
    }
    return true
}
```

#### 1.3 `metadataKeyOf()` — om: kurzer Key

```go
func metadataKeyOf(n *xml.Name) string {
    switch n.Space {
    case net.NsOwncloudMetadata:
        // om:aktencode → "aktencode"
        // om:parent-aktencode → "parent-aktencode" (wird später aufgelöst)
        return n.Local
    default:
        // ... bestehendes Verhalten
    }
}
```

xattr-Pfad wird damit: `user.oc.md.aktencode` (sauber, kurz)

#### 1.4 `parent-` Prefix Handling

Wenn ein `om:parent-*` Key angefragt wird:

1. Prefix `parent-` erkennen
2. Parent-Node statten (über `ParentID` des Items — ist bereits im ResourceInfo)
3. xattr `user.oc.md.{rest}` vom Parent-Node lesen
4. Wert als `<om:parent-{rest}>` im Response zurückgeben

```go
// In metadataKeys() oder mdToPropResponse():
if strings.HasPrefix(n.Local, "parent-") {
    parentKey := n.Local[len("parent-"):]
    // stat parent node, read xattr user.oc.md.{parentKey}
}
```

**Wichtig:** Abstrakt und generisch halten — nicht auf `aktencode` hartcodieren.
Jedes `om:parent-*` Property löst den gleichen Mechanismus aus.

#### 1.5 Search-Report

Der Search-Report (`oc:search-files`) muss `om:` Properties ebenfalls unterstützen:
- `ArbitraryMetadataKeys` aus dem Request parsen (funktioniert bereits generisch)
- `parent-` Keys: zusätzlich Parent-Node des Treffers statten

---

### 2. web-client — `om:` Namespace im XML (builders.ts)

**Datei:** `packages/web-client/src/webdav/client/builders.ts`

#### 2.1 Namespace deklarieren

```ts
const xmlObj = {
    [bodyType]: {
        'd:prop': props,
        '@@xmlns:d': 'DAV:',
        '@@xmlns:oc': 'http://owncloud.org/ns',
        '@@xmlns:om': 'http://owncloud.org/ns/metadata',  // NEU
        // ...
    }
}
```

#### 2.2 extraProps mit om: korrekt namespaced ausgeben

```ts
// getNamespacedDavProps anpassen
if (extraProps.includes(name)) {
    if (name.startsWith('om:')) {
        return [`om:${name.slice(3)}`, value || '']
    }
    return [name, value || '']
}
```

#### 2.3 buildResource — extraProps parsen

**Datei:** `packages/web-client/src/helpers/resource/functions.ts`

`om:`-prefixed extraProps in `resource.extraProps` aufnehmen (Zeile 126-133).
Key-Normalisierung: `om:aktencode` → `extraProps['om:aktencode']` oder
alternativ `extraProps.aktencode` (Namespace strippen, da eindeutig).

---

### 3. web-pkg — Keine Änderung nötig

Web/ bietet bereits alle nötigen Extension Points:
- `SearchExtension` → eigene `previewSearch.component` / `listSearch.component`
- `FolderViewExtension` → eigene Darstellungskomponente
- `additionalResourceContent` Slot → Inhalte unter dem Namen
- `extraProps` auf `Resource` → Daten aus WebDAV Properties

Kein neuer Extension-Typ nötig. Folderviews nutzt diese bestehenden Mechanismen.

---

### 4. opencloud_folderviews — Aktenzeichen in Suche

#### 4.1 extraProps registrieren

```ts
clientService.webdav.registerExtraProp('om:aktencode')
clientService.webdav.registerExtraProp('om:parent-aktencode')
```

#### 4.2 Quickview (Suchleiste Preview)

Eigene `previewSearch.component` die `ResourcePreview` wrappt und
das Aktenzeichen aus `resource.extraProps['om:aktencode']` anzeigt —
sofern User-Preference aktiviert.

#### 4.3 Ergebnisliste

Aktenzeichen via `additionalResourceContent`-Slot oder eigene
`listSearch.component` die die bestehende `List.vue` wrappt.

#### 4.4 User-Preference

Steuerung ob Aktencode-Prefix sichtbar ist — über bestehenden
Extension-Registry `userPreference`-Mechanismus.

---

## Rendering-Ergebnis

### Quickview (Suchleiste Preview)

```
[AZ-2024/0815] Vertrag.pdf
  📁 [AZ-2024/0700] Verträge/
```

### Ergebnisliste (/files/search/list)

```
[AZ-2024/0815] Vertrag.pdf          12 KB    14.07.2026
  📁 [AZ-2024/0700] Verträge/
  ...ein Auszug aus dem Vertrag...   (highlights)
```

### Alle Ansichten (Ordner, Favoriten, Shares, Trash, Spaces)

Da der `#title` Slot in `ResourceTable` und `ResourceTile` sitzt,
greift er überall — nicht nur in der Suche. Folderviews steuert
per `extensionPointIds` in welchen Ansichten Aktenzeichen erscheinen.

---

## Fortschritt

### Phase 1: reva — DONE
1. [x] `NsOwncloudMetadata` Namespace-Konstante (`net.go`)
2. [x] `requiresExplicitFetching` → `om:` → true
3. [x] `metadataKeyOf` → `om:` → kurzer Key (`n.Local`)
4. [x] `metadataKeys` → `parent-` Keys separieren
5. [x] `proppatch.go` → `om:` Properties mit kurzem Key schreiben
6. [x] Parent-Metadata Lookup: `resolveParentMetadata()` batch-stattet Parent-Nodes
7. [x] `MultistatusResponseWithParent()` — neuer Einstiegspunkt mit Parent-Auflösung
8. [x] `mdToPropResponse` → `om:parent-*` aus parentMetadataMap auflösen
9. [x] `propfindResponse` → gwClient holen und `parentMetadataKeys` durchreichen
10. [x] Abwärtskompatibel: `MultistatusResponse` bleibt als Wrapper erhalten

### Phase 2: web-client — DONE
11. [x] `builders.ts` — `xmlns:om` Deklaration (nur bei Bedarf)
12. [x] `builders.ts` — `om:` extraProps korrekt als `om:name` ausgeben
13. [x] `builders.ts` — `buildPropPatchBody` unterstützt `om:` + xmlns
14. [x] `NsOwncloudMetadata` Konstante exportiert
15. [x] 12 Unit-Tests für builders.ts — alle bestanden

### Phase 3: web-pkg — DONE
16. [x] `#title` Slot in `ResourceTable.vue` und `ResourceTile.vue`

Der `#title` Slot wrappt das gesamte `ResourceListItem` (Dateiname + Elternverzeichnis).
Kein neuer Extension-Typ nötig. Der Slot liefert die vollständige `Resource`
(inkl. `extraProps` mit allen `om:*` Metadaten). Default-Content ist das bestehende
`ResourceListItem` — kein visueller Change ohne Extension.

Slot-Props folgen der jeweiligen Komponenten-Konvention:
- `ResourceTable`: `#title="{ resource }"`
- `ResourceTile`: `#title="{ item }"`

Der Slot greift **überall** — Suche, Ordneransicht, Favoriten, Shares, Trash, Spaces.
Folderviews entscheidet selbst wo und wie Aktenzeichen angezeigt werden.

### Phase 4: opencloud_folderviews — OFFEN
17. [ ] bestehende `oc:oy.*` extraProps auf `om:oy.*` migrieren (~15 Stellen)
18. [ ] `om:aktencode` + `om:parent-aktencode` als extraProps registrieren
19. [ ] `#title` Slot nutzen um Aktenzeichen an Item-Name und Parent-Folder anzuzeigen
20. [ ] Quickview: eigene `previewSearch.component` die `ResourcePreview` wrappt
21. [ ] User-Preference "Aktenzeichen anzeigen" steuert Sichtbarkeit

### Phase 5: Verifikation — OFFEN
22. [ ] reva Go-Tests via `opencloud/Dockerfile.test` (Go 1.26)
23. [ ] E2E-Test: Search mit `om:aktencode` + `om:parent-aktencode`

---

## Risikoabschätzung: extraProp-Nutzung im Gesamtsystem

### Bestandsaufnahme aller extraProp-Aufrufe

#### web-client (Infrastruktur)

| Datei | Stellen | Funktion | Änderung nötig |
|---|---|---|---|
| `builders.ts` | 6 | XML-Body: extraProps ohne Namespace ausgeben | Ja — `om:` Prefix erkennen, als `om:` + xmlns ausgeben |
| `dav.ts` | 4 | `extraProps: string[]` Array, durchgereicht | Nein — Array-Typ bleibt, Strings ändern sich nur im Format |
| `functions.ts` | 6 | `buildResource()` — parst extraProps aus Response | Ja — Zeile 129 `name.split(':').pop()` muss `om:` Keys korrekt handlen |
| `search.ts` | 1 | `buildResource(r, dav.extraProps)` | Nein — durchreichend |
| `listFiles.ts` | 4 | `buildResource(c, dav.extraProps)` | Nein — durchreichend |
| `listFileVersions.ts` | 1 | `buildResource(v, dav.extraProps)` | Nein — durchreichend |
| `index.ts` | 2 | `registerExtraProp()` Factory | Nein — nimmt weiterhin Strings |
| `types.ts` | 2 | Interface + `extraProps?: Record<string, unknown>` | Nein |

#### opencloud_folderviews (einziger Consumer)

| Datei | Stellen | Aktuell | Migration |
|---|---|---|---|
| `index.ts:379-383` | 5 | `registerExtraProp('oc:oy.fileReference')` | → `'om:oy.fileReference'` |
| | | `registerExtraProp('oc:oy.color')` | → `'om:oy.color'` |
| | | `registerExtraProp('oc:oy.note')` | → `'om:oy.note'` |
| | | `registerExtraProp('oc:oy.app')` | → `'om:oy.app'` |
| | | `registerExtraProp('oc:oy.ftype')` | → `'om:oy.ftype'` |
| `TypedFolderToolbar.vue` | 3 | `extraProps?.['oc:oy.ftype']` etc. | String-Ersetzung `oc:` → `om:` |
| `ResourceTree.vue` | 3 | `extraProps['oc:oy.fileReference']` etc. | String-Ersetzung `oc:` → `om:` |
| `ResourceElements.vue` | 1 | `extraProps?.['oc:oy.ftype']` | String-Ersetzung `oc:` → `om:` |
| `ResourceMetro.vue` | 1 | `extraProps?.[key]` (generisch) | Keine Änderung |
| `ElementContainer.vue` | 1 | `extraProps?.['oc:oy.ftype']` | String-Ersetzung `oc:` → `om:` |
| `useFileReference.ts` | 1 | `extraProps?.[PROP_KEY]` | PROP_KEY Konstante ändern |

#### Alle anderen opencloud* Packages

Keine Treffer. Nur `opencloud_folderviews` nutzt `extraProp`.

#### Tests

| Datei | Stellen | Änderung |
|---|---|---|
| `web-client/.../functions.spec.ts` | 4 | Test-Keys an `om:` Format anpassen |
| `web-pkg/.../vaultWebDav.spec.ts` | 3 | Mock für `registerExtraProp` — keine Änderung |

### Risikobewertung

| Bereich | Stellen | Risiko | Begründung |
|---|---|---|---|
| **web-client builders.ts** | 6 | **Mittel** | Kernstück der XML-Generierung, braucht sorgfältige Tests |
| **web-client functions.ts** | 1 | **Niedrig** | Eine Zeile Key-Parsing, klar definiertes Verhalten |
| **opencloud_folderviews** | ~15 | **Niedrig** | Reine String-Ersetzung `oc:` → `om:`, kein Logik-Change |
| **reva propfind.go** | 3 Funktionen | **Mittel-Hoch** | Neuer Codepfad (om: + parent-), braucht Unit-Tests |
| **web-pkg ResourceTable/Tile** | 2 | **Niedrig** | Additiv, `#title` Slot mit Default-Content |

### Kritisch: xattr-Migration

Die xattr-Keys ändern sich bei der Umstellung von `oc:` auf `om:`.

**Aktuell (oc:):** `registerExtraProp('oc:oy.fileReference')`
- builders.ts: `<oc:oy.fileReference/>` im XML
- reva metadataKeyOf: Key = `"http://owncloud.org/ns/oy.fileReference"`
- decomposedfs: xattr = `user.oc.md.http://owncloud.org/ns/oy.fileReference`

**Neu (om:):** `registerExtraProp('om:oy.fileReference')`
- builders.ts: `<om:oy.fileReference/>` im XML
- reva metadataKeyOf: Key = `"oy.fileReference"` (nur Local)
- decomposedfs: xattr = `user.oc.md.oy.fileReference`

**Prüfung nötig:** Was liegt tatsächlich als xattr auf dem Filesystem?
Je nachdem wie reva aktuell den `oc:` Prefix bei extraProps handelt,
könnte der bestehende xattr-Key anders aussehen als erwartet.

Mögliche Szenarien:
1. xattr ist `user.oc.md.http://owncloud.org/ns/oy.fileReference` → Migration nötig
2. xattr ist `user.oc.md.oy.fileReference` → Kein Change, om: liefert gleichen Key
3. xattr ist `user.oc.md.oc:oy.fileReference` → Migration nötig

**Empfehlung:** Vor Implementierung auf einem bestehenden System mit
`getfattr -d -m "user.oc.md" /path/to/node` den tatsächlichen Key prüfen.
Dann entscheiden ob reva einen Migrations-Fallback braucht (beide Keys lesen,
neuen Key schreiben).

---

## Nicht im Scope

- Migration bestehender `user.oc.md.http://owncloud.org/ns/*` xattrs (gibt es nicht für Aktenzeichen)
- Umstellung von `libre.graph.*` Props auf `om:` (spätere Optimierung)
- Änderungen an `oc:` Whitelist in `requiresExplicitFetching` (bleibt wie ist)
- Breadcrumb-Aktenzeichen (separater Task)

---

## Betroffene Dateien

### reva
- `internal/http/services/owncloud/ocdav/net/net.go` — Namespace-Const
- `internal/http/services/owncloud/ocdav/propfind/propfind.go` — requiresExplicitFetching, metadataKeyOf, parent-Lookup

### web-client
- `packages/web-client/src/webdav/client/builders.ts` — xmlns:om, om: Handling
- `packages/web-client/src/helpers/resource/functions.ts` — extraProps Parsing
- `packages/web-client/src/helpers/resource/types.ts` — optional: parentMetadata auf Resource

### web-pkg
- `packages/web-pkg/src/components/FilesList/ResourceTable.vue` — `#title` Slot
- `packages/web-pkg/src/components/FilesList/ResourceTile.vue` — `#title` Slot

### opencloud_folderviews
- `index.ts` — `oc:oy.*` → `om:oy.*` + neue `om:aktencode`/`om:parent-aktencode` extraProps
- Neue/erweiterte Search-Komponenten für Aktenzeichen-Anzeige in Quickview + Ergebnisliste
