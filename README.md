# Med-App

## Gemini-Text-zu-Lernspiel (sicher)

Die Fall-Schmiede unterstützt jetzt:
- anonymisierten Lerntext einfügen,
- serverseitige Generierung über `/api/generate-case`,
- automatische Validierung des erzeugten Falls,
- direktes Speichern in `localStorage.custom_cases` und sofortige Dashboard-Anzeige.

> **Wichtig:** Nur anonymisierte Lerntexte senden. Keine Namen, Geburtsdaten, Adressen oder sonstige identifizierende Patientendaten eingeben. Generierte Inhalte sind Lernmaterial und **keine medizinische Beratung**.

---

## Architektur

Frontend (`index.html`, `js/app.js`):
- nimmt Lerntext entgegen,
- ruft konfigurierbaren Backend-Endpunkt auf (Standard: `/api/generate-case`),
- zeigt Lade-/Erfolgs-/Fehlerzustände,
- validiert JSON-Schema und speichert den Fall.

Backend (`api/generate-case.js`):
- liest `GEMINI_API_KEY` nur serverseitig,
- ruft Gemini API (`generateContent`) mit JSON-Ausgabe (`responseMimeType: application/json`) auf,
- validiert Antwort erneut gegen die MediChecker-Fallstruktur,
- gibt keine Geheimnisse in Fehlermeldungen zurück.

Gemeinsame Validierung (`js/case-schema.js`):
- Markdown-Fences/typografische Quotes bereinigen,
- JSON robust parsen,
- Schema prüfen (`case_id`, `timeline`, `phase`, `content`, `hotspots`, etc.),
- sichere `case_id` erzwingen (`[A-Za-z0-9_-]`, 3-80 Zeichen).

---

## Gemini API Key einrichten

1. Gemini API Key erstellen (Google AI Studio / Gemini API).
2. Key **nicht** ins Frontend eintragen.
3. Als Server-Umgebungsvariable setzen:

```bash
GEMINI_API_KEY=...
```

Beispielvariablen siehe `.env.example`.

### Relevante Umgebungsvariablen

- `GEMINI_API_KEY` (Pflicht)
- `GEMINI_MODEL` (optional, Default `gemini-1.5-flash`)
- `GEMINI_API_BASE_URL` (optional)
- `MAX_SOURCE_TEXT_CHARS` (optional, Default `12000`)
- `GEMINI_TIMEOUT_MS` (optional, Default `25000`)
- `ALLOWED_ORIGIN` (optional, für enge CORS-Freigabe)

---

## Lokale Entwicklung

```bash
npm test
```

Die Tests prüfen:
- JSON-Bereinigung/Parsing,
- Schema-Validierung,
- Backend-Request-Flow ohne echten Gemini-Request (gemockt).

Für lokales API-Testing kann die Serverless-Funktion in einer Plattform-CLI (z. B. Vercel/Netlify) ausgeführt werden.

---

## Deployment-Hinweise

Dieses Repository ist statisch. Für die sichere KI-Funktion brauchst du ein serverseitiges Ziel für `api/generate-case.js` (z. B. Vercel Functions oder Netlify Functions).

### Option A: Gleiches Deployment (gleiche Origin)
- Frontend + Funktion auf derselben Plattform deployen.
- Standard-Endpunkt `/api/generate-case` funktioniert direkt.

### Option B: Getrenntes Backend
- Funktion separat deployen.
- In der Fall-Schmiede den Endpoint auf die Backend-URL setzen.
- `ALLOWED_ORIGIN` auf deine Frontend-Domain setzen.

---

## Datenschutz- und Nutzungsgrenzen

- Lerntexte werden an einen externen KI-Dienst gesendet.
- Datenschutz und regulatorische Anforderungen müssen projektspezifisch geprüft werden.
- Free-Tier-Limits/Verfügbarkeit können sich jederzeit ändern und sind nicht garantiert.
