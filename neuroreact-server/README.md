# NeuroReact WebSocket Server

## Deployment auf Railway.app (kostenlos, 5 Minuten)

### Schritt 1 — Account
- Geh auf https://railway.app
- Kostenlosen Account mit GitHub erstellen

### Schritt 2 — Projekt erstellen
- "New Project" → "Deploy from GitHub repo"
- Diesen `neuroreact-server` Ordner als GitHub Repository hochladen
  (github.com → New repo → Dateien hochladen)

### Schritt 3 — Deployment
- Railway erkennt automatisch Node.js
- Nach dem Deploy bekommst du eine URL wie:
  `neuroreact-server-production-xxxx.up.railway.app`

### Schritt 4 — URL in App eintragen
- Öffne `index.html` in der neuroreact-pwa
- Suche nach: `const WS_URL = 'wss://neuroreact-server.up.railway.app'`
- Ersetze die URL mit deiner Railway-URL (mit `wss://` davor!)

### Schritt 5 — Fertig!
- App auf Netlify neu hochladen
- 📡 Sync-Button erscheint oben rechts in den Einstellungen

## Wie es funktioniert
1. Trainer tippt auf 📡 Sync → "Raum erstellen" → bekommt 5-stelligen Code
2. Spieler tippen auf 📡 Sync → "Spieler" Tab → Code eingeben → Verbinden
3. Alle Reize die der Trainer sieht, erscheinen gleichzeitig auf allen Spieler-Geräten
