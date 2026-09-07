# Subspace-Bug: Ordner wird nur halb zum Subspace (2026-09-05)

## Symptom

Ordner **"Zentrales Netz inklusive Telekommunikation"** (Aktenzeichen 11.16.05) im
Project Space **"Innere Verwaltung"** (Space-ID `5ac86946-ee5f-4fa7-ac60-04aa9397dae8`,
node-ID `968126d3-4e85-4202-b958-ff154bbf0c3a`) wird beim Anlegen als Subspace
**nur zur Hälfte** angelegt:

- Grants + `user.oc.space.id` sind gesetzt
- Registry-Eintrag am Space-Root (`user.oc.subspaces`) ist **leer**
- Folge: UI zeigt den Ordner im "Subspace"-Panel an (das ist aber für jeden
  teilbaren Ordner sichtbar), aber der Server behandelt ihn nicht als Subspace:
  `GET /drives/{id}/items/{node}/space` → `{"type":"space"}`, `GET /subspaces` → `[]`

## Kausalkette (vollständig, live belegt)

1. Space `5ac86946` hat **kein** `user.oc.owner.type` xattr am Space-Root.
   → `readOwner()` (node.go:634) liefert `owner.Type = USER_TYPE_PRIMARY` (=1).
   (Alle funktionierenden Spaces haben `owner.type=spaceowner`.)

2. UI-Aktion `POST /graph/.../items/...!968126d3.../invite` (Log 15:28:03, 200 OK)
   → reva `AddGrant` (grants.go:143) ruft `autoAddSubspace` auf.

3. `autoAddSubspace` (grants.go:383) Check Zeile 391:
   `if owner.Type != USER_TYPE_SPACE_OWNER { skip }`.
   primary(1) != spaceowner → **`skip (not project space)`** (Log belegt: `ownerType=1`).

4. Grants werden gespeichert, Registry-Eintragung wird nie gemacht → halb Subspace.

Vergleich (live): Space `testspace`/`11-innere-verwaltung`/`posteingang`/`test4`/`test5`
haben alle `owner.type=spaceowner` → Subspaces dort funktionieren.

## Zwei getrennte Bugs

### Bug 1: Fehlendes `user.oc.owner.type` am Space-Root (Daten)
Space `5ac86946` "Innere Verwaltung" hat das xattr nicht. Ursache unklar
(wurde Space neu angelegt/migriert am 12.08.2026?). `autoAddSubspace` hängt an
diesem xattr, weil `Owner()` es als Proxy für "ist Project Space" nutzt.

### Bug 2: `autoAddSubspace` nutzt falschen/zu strengen Check (Code)
- Prüft `owner.Type == USER_TYPE_SPACE_OWNER` statt `space.type == project`.
- `UserTypeMap` (utils.go:336) übersetzt `owner.type="spaceowner"` → hartcodiert `8`
  (NICHT die Konstante `USER_TYPE_SPACE_OWNER`) → fragil.
- Bei Spaces ohne `owner.type`-xattr wird falsch negativ (primary).

### Bug 3: Kein Transaktionscharakter / kein Pre-Check (Code)
`AddGrant` = Schritt 1 `storeGrant` + Schritt 2 `autoAddSubspace`.
Wenn Schritt 2 skipped/fehlschlägt → Grants bleiben, Registry leer. Weder Rollback
noch Vorab-Prüfung. Fehler werden nur warn-gelogt, nie propagiert.

### Bug 4: Widersprüchliche Rollenvoraussetzung (Code)
- Expliziter Pfad (`UpdateStorageSpace` + `subspace.add`, spaces.go:702) prüft
  `permissions.IsManager(sp)` → **Manager erlaubt**.
- Automatischer Pfad (`autoAddSubspace`, grants.go:391) prüft
  `owner.Type == USER_TYPE_SPACE_OWNER` → **nur Space-Owner**.
→ Inconsistent. Manager können im expliziten Pfad Subspaces anlegen, im
  automatischen (beim Grant) nicht.

## Fix-Optionen

1. **Data-Fix (sofort, Space 5ac86946):** `user.oc.owner.type=spaceowner` am
   Space-Root nachtragen ODER Registry-Eintrag für `968126d3` manuell schreiben.
   Dann funktioniert der ordner.

2. **Code-Fix reva `autoAddSubspace`:**
   - Check auf `space.type == project` statt `owner.type == spaceowner`.
   - Pre-Check **vor** `storeGrant` (Prüfung ob Subspace-Anlegen erlaubt ist),
     sonst kein halb-angetragener Zustand.
   - `IsManager` (bzw. Owner-oder-Manager) statt reinem Owner-Check, um mit
     dem expliziten Pfad konsistent zu sein.
   - `UserTypeMap`: `spaceowner` → echte `USER_TYPE_SPACE_OWNER`-Konstante statt `8`.

## Fix-Entscheidung (2026-09-05)

Semantik: **space.type == project UND User ist Space-Manager** — aber die
Manager-Prüfung gilt **nur dort, wo ein Grant tatsächlich einen Subspace
wird** (nicht-Wurzel-Ordner in Projekt-Space, noch nicht in Registry, erster
Grant). Einfache Invites bleiben davon unberührt.

### reva (`grants.go autoAddSubspace`) — umgesetzt (Commit 7ad62475d)
- `n.SpaceRoot.XattrSpaceType` == `project` (statt `owner.type`).
- `fs.p.AssemblePermissions` + `permissions.IsManager(rp)` als zweiter Check.
- Beide Checks liegen nach "nicht Wurzel" + "noch kein Subspace", also exakt im
  Subspace-creating-Zweig. Nicht-Manager → `skip (not a space manager)`, kein
  halber Subspace.

### graph API (`api_driveitem_permissions.go Invite`) — umgesetzt (Commit a451df5bd9)
- Neuer Pre-Check `ensureSubspaceManager` **vor** der Share-Erstellung.
- Erkennt dieselbe Subspace-creating-Kondition über die CS3-API:
  `!IsSpaceRoot` + `RESOURCE_TYPE_CONTAINER` + `space.SpaceType==project` +
  nicht in `subspaces`-Opaque-Liste + `ListGrants` leer.
- Nur dann: `ensureSpaceManagerRole` (utils.GetSpaceMembers mit `utils.ManagerRole`
  == reva IsManager) → sonst 403 `AccessDenied`.
- Damit kein halb-angetragener Zustand: Manager-Check greift VOR dem Grant.

## Status
- [x] Root Cause identifiziert + live belegt (Log 15:28:03, xattr, Vergleich)
- [x] Code-Fix reva (space.type + IsManager, Commit 7ad62475d)
- [x] Code-Fix graph API Pre-Check (Commit a451df5bd9)
- [ ] Build (job.py build-pod) + Deploy auf brandis
- [ ] Data-Fix Space 5ac86946 (owner.type xattr oder Registry-Eintrag 968126d3)
- [ ] Verifikation live: Subspace "Zentrales Netz..." vollständig
