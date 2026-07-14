# SPEC: om: WebDAV Namespace for Custom Metadata

## 1. Problem

Custom-Metadaten (Aktenzeichen, Dokumenttyp, etc.) haben im aktuellen WebDAV-Stack
keinen sauberen Mechanismus:

1. **Keine Namespace-Trennung** — Custom-Metadaten teilen sich `oc:` mit System-Properties
2. **Statische Whitelist** — `requiresExplicitFetching()` muss für jedes neue Property
   manuell erweitert werden; unbekannte `oc:` Properties werden ignoriert
3. **Hässliche xattr-Keys** — `metadataKeyOf()` baut den vollen Namespace-URL in den Key:
   `user.oc.md.http://owncloud.org/ns/aktencode` statt `user.oc.md.aktencode`
4. **Kein Parent-Metadata** — Suchergebnisse liefern nur Item-Properties,
   nicht die Metadaten des übergeordneten Ordners

## 2. Lösung

Ein eigener WebDAV-Namespace `om:` (opencloud metadata) für Custom-Metadaten.

```
Namespace URI:  http://owncloud.org/ns/metadata
Prefix:         om
```

### 2.1 Abgrenzung der Namespaces

| Namespace | Prefix | Zweck | Beispiel |
|---|---|---|---|
| `DAV:` | `d:` | WebDAV-Standard | `d:getlastmodified` |
| `http://owncloud.org/ns` | `oc:` | System-Properties (fest im Code) | `oc:fileid`, `oc:permissions` |
| `http://owncloud.org/ns/metadata` | `om:` | Custom-Metadaten (dynamisch) | `om:aktencode`, `om:typ` |

### 2.2 Konvention: Parent-Prefix

Properties mit dem Prefix `parent-` beziehen sich auf den übergeordneten Ordner:

```
om:aktencode         → xattr user.oc.md.aktencode am Item selbst
om:parent-aktencode  → xattr user.oc.md.aktencode am Parent-Folder des Items
```

Der `parent-` Prefix ist generisch — er funktioniert für jedes `om:` Property.

## 3. WebDAV-Protokoll

### 3.1 PROPFIND Request

```xml
<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:"
            xmlns:oc="http://owncloud.org/ns"
            xmlns:om="http://owncloud.org/ns/metadata">
  <d:prop>
    <oc:fileid/>
    <oc:name/>
    <d:getlastmodified/>
    <om:aktencode/>
    <om:typ/>
    <om:parent-aktencode/>
  </d:prop>
</d:propfind>
```

### 3.2 PROPFIND Response

```xml
<d:multistatus xmlns:d="DAV:"
               xmlns:oc="http://owncloud.org/ns"
               xmlns:om="http://owncloud.org/ns/metadata">
  <d:response>
    <d:href>/dav/spaces/...</d:href>
    <d:propstat>
      <d:prop>
        <oc:fileid>abc123</oc:fileid>
        <oc:name>Vertrag.pdf</oc:name>
        <om:aktencode>11.12.01.03-03</om:aktencode>
        <om:typ>Schriftstueck</om:typ>
        <om:parent-aktencode>11.12.01</om:parent-aktencode>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>
```

### 3.3 PROPPATCH (Metadaten schreiben)

```xml
<?xml version="1.0" encoding="utf-8"?>
<d:propertyupdate xmlns:d="DAV:"
                  xmlns:om="http://owncloud.org/ns/metadata">
  <d:set>
    <d:prop>
      <om:aktencode>11.12.01.03-03</om:aktencode>
      <om:typ>Schriftstueck</om:typ>
    </d:prop>
  </d:set>
</d:propertyupdate>
```

### 3.4 REPORT (Search)

`om:` Properties werden im `oc:search-files` REPORT genauso angefragt
wie in PROPFIND — sie erscheinen im `<d:prop>` Block.

`parent-` Properties erfordern serverseitig einen zusätzlichen Stat
auf den Parent-Node des Suchergebnis-Items.

## 4. Storage-Mapping

### 4.1 xattr-Pfade

```
om:aktencode         → metadataKeyOf() → "aktencode"
                     → decomposedfs    → user.oc.md.aktencode

om:parent-aktencode  → metadataKeyOf() → "parent-aktencode"
                     → reva parst parent- Prefix
                     → stat Parent-Node
                     → liest xattr      user.oc.md.aktencode vom Parent
```

### 4.2 Vergleich alt vs. neu

| | Alt (oc:) | Neu (om:) |
|---|---|---|
| Request | `<aktencode xmlns="http://owncloud.org/ns"/>` | `<om:aktencode/>` |
| metadataKeyOf | `"http://owncloud.org/ns/aktencode"` | `"aktencode"` |
| xattr | `user.oc.md.http://owncloud.org/ns/aktencode` | `user.oc.md.aktencode` |
| requiresExplicitFetching | `false` (nicht in Whitelist!) | `true` (ganzer Namespace) |
| Parent-Daten | Nicht möglich | `om:parent-*` |

## 5. Regeln

### 5.1 Allgemein

- `om:` Properties sind immer optional — fehlende Properties sind `404 Not Found`
- `om:` Property-Namen sind lowercase, Bindestriche als Trenner
- `om:parent-*` Properties sind read-only — Schreiben nur direkt am Objekt
- Keine verschachtelten XML-Strukturen — nur flache String-Werte
- Leere Werte werden nicht zurückgegeben (wie bei `oc:` Properties)

### 5.2 Reservierte Prefixe

| Prefix | Bedeutung |
|---|---|
| `parent-` | Metadaten des direkten Eltern-Ordners |
| *(Zukunft)* `ancestor-` | Metadaten aus dem Pfad nach oben (erster Treffer) |

### 5.3 Keine Einschränkung der Property-Namen

Jeder `om:` Property-Name der XML-valide ist, wird akzeptiert.
Reva braucht keine Whitelist — `requiresExplicitFetching` liefert für
den gesamten `om:` Namespace `true`.

## 6. Web-UI Integration

### 6.1 Registration

```ts
// Extension registriert Custom-Metadaten-Properties
clientService.webdav.registerExtraProp('om:aktencode')
clientService.webdav.registerExtraProp('om:parent-aktencode')
```

### 6.2 Zugriff

```ts
// Nach PROPFIND/Search: Werte auf resource.extraProps
const aktencode = resource.extraProps?.['om:aktencode']
const parentAktencode = resource.extraProps?.['om:parent-aktencode']
```

### 6.3 Anzeige via ResourceNameDecorator

```ts
// Extension Point: global.files.resource-name-decorator
{
    type: 'resourceNameDecorator',
    getNamePrefix(resource: Resource): string | null {
        return resource.extraProps?.['om:aktencode'] || null
    },
    getFolderPrefix(resource: Resource): string | null {
        return resource.extraProps?.['om:parent-aktencode'] || null
    }
}
```

Greift automatisch in:
- Suchleiste Quickview (ResourcePreview → ResourceListItem)
- Suchergebnisliste (ResourceTable → ResourceListItem)
- Ordneransichten (GenericSpace → ResourceTable → ResourceListItem)

## 7. reva Implementierung

### 7.1 Betroffene Dateien

| Datei | Änderung |
|---|---|
| `ocdav/net/net.go` | `NsOwncloudMetadata` Konstante |
| `ocdav/propfind/propfind.go` | `requiresExplicitFetching`, `metadataKeyOf`, `mdToPropResponse`, Parent-Lookup |
| `ocdav/proppatch.go` | `om:` Namespace beim Schreiben: Key = `n.Local` (kurz) |

### 7.2 Parent-Lookup Algorithmus

```
1. Request enthält om:parent-aktencode
2. metadataKeys() erkennt parent- Prefix
3. Splittet: parentKey = "aktencode"
4. Fügt "aktencode" zu den ArbitraryMetadataKeys des Parent-Stat hinzu
5. Stat auf Parent-Node (ParentID ist bereits bekannt)
6. Liest ArbitraryMetadata["aktencode"] vom Parent
7. Liefert Wert als <om:parent-aktencode> im Response
```

Bei Search-Results: Der Parent-Stat ist ein zusätzlicher Call pro Treffer.
Optimierung: Parent-IDs gruppieren, Batch-Stat.

### 7.3 Abwärtskompatibilität

- `oc:` Namespace bleibt vollständig unverändert
- Bestehende Whitelist in `requiresExplicitFetching` wird nicht angefasst
- Bestehende xattrs unter `user.oc.md.*` bleiben lesbar
- Keine Migration nötig — `om:` Properties schreiben neue, kurze Keys

## 8. Sicherheit

- `om:` Properties unterliegen den gleichen Berechtigungen wie `oc:` ArbitraryMetadata
- Schreiben erfordert `InitiateFileUpload` Permission (wie bisher)
- `parent-` Properties sind read-only — kein Schreiben auf Parent via Child-Request
- Keine Traversierung über `parent-` hinaus (kein `parent-parent-`)
