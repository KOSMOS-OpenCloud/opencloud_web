# Groupware API Endpoints

Base URL: `{serverUrl}/groupware/` (configured via `FRONTEND_GROUPWARE_ENABLED=true`)

Enabled via config: `configStore.groupwareUrl` → `{serverUrl}/groupware/`

## Mail (web-app-mail)

### Mailboxes

| Method | Endpoint | Beschreibung |
|---|---|---|
| GET | `accounts/{accountId}/mailboxes` | Liste aller Mailboxen (Inbox, Sent, Drafts, ...) |
| GET | `accounts/{accountId}/mailboxes/{mailboxId}/emails` | E-Mails in einer Mailbox |

### E-Mails

| Method | Endpoint | Beschreibung |
|---|---|---|
| GET | `accounts/{accountId}/emails/{mailId}?markAsSeen=true` | Einzelne E-Mail laden (und als gelesen markieren) |
| POST | `accounts/{accountId}/emails` | Entwurf erstellen |
| PUT | `accounts/{accountId}/emails/{emailId}` | Entwurf aktualisieren |
| DELETE | `accounts/{accountId}/emails/{emailId}` | Entwurf löschen |
| POST | `accounts/{accountId}/emails/{emailId}?identity=...&move-from=...&move-to=...` | Entwurf senden |

### Blobs (Anhänge)

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `accounts/{accountId}/blobs` | Anhang hochladen |
| GET | `accounts/{accountId}/blobs/{blobId}/{filename}` | Anhang herunterladen |
| GET | `accounts/{accountId}/blobs/{blobId}/{filename}?type=...` | Kalender-Anhang (ICS) |

### Termine (Appointments)

Kalender-Einladungen werden als Anhänge in E-Mails behandelt.
Accept/Decline über Blob-Download mit `?type=accept` / `?type=decline`.

## Contacts (web-app-contacts)

### Adressbücher

| Method | Endpoint | Beschreibung |
|---|---|---|
| GET | `accounts/{accountId}/addressbooks` | Liste aller Adressbücher |
| GET | `accounts/{accountId}/addressbooks/{addressBookId}/contacts` | Kontakte in einem Adressbuch |

### Kontakte

| Method | Endpoint | Beschreibung |
|---|---|---|
| GET | `accounts/{accountId}/contacts` | Alle Kontakte |
| POST | `accounts/{accountId}/contacts` | Kontakt erstellen |

## Aktivierung

### OpenCloud Server

```yaml
# opencloud.yaml oder ENV
FRONTEND_GROUPWARE_ENABLED: true
```

### Proxy-Konfiguration

Der `/groupware/` Pfad muss an einen Groupware-Backend-Service geroutet werden,
der die obigen REST-Endpoints implementiert. Das Backend ist **nicht** Teil von
OpenCloud — es muss separat bereitgestellt werden.

Mögliche Backends (unklar, nicht dokumentiert):
- Eigener Groupware-Service (geplant?)
- Stalwart (JMAP → REST Adapter?)
- OX App Suite (REST API?)

## Datenmodelle

### MailboxResponse
```json
{
  "id": "string",
  "name": "string",       // "INBOX", "Sent", "Drafts", ...
  "unreadCount": 0,
  "totalCount": 0
}
```

### EmailResponse
```json
{
  "id": "string",
  "subject": "string",
  "from": [{"name": "...", "email": "..."}],
  "to": [{"name": "...", "email": "..."}],
  "date": "2026-07-14T...",
  "body": "string",
  "attachments": [{"blobId": "...", "name": "...", "size": 0}],
  "seen": true
}
```

### ContactResponse
```json
{
  "id": "string",
  "displayName": "string",
  "email": "string",
  "phone": "string",
  "organization": "string"
}
```

Hinweis: Die Datenmodelle sind aus dem Frontend-Code abgeleitet und könnten
unvollständig sein. Die tatsächliche API-Spezifikation hängt vom Backend ab.
