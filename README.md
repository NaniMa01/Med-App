# Med-App

Vanilla HTML/CSS/JavaScript Lern-App mit lokaler Fall-Schmiede und optionaler Gemini-gestützter Fallgenerierung über einen **serverseitigen** Vercel-Endpoint.

## Gemini API Setup

### Erforderlich
- `GEMINI_API_KEY` (Google AI Studio / Gemini API Key)

### Optional
- `GEMINI_MODEL` (Standard: `gemini-1.5-flash`)

### Vercel
1. Projekt in Vercel öffnen.
2. **Settings → Environment Variables**.
3. `GEMINI_API_KEY` setzen.
4. Optional `GEMINI_MODEL` setzen.
5. Redeploy ausführen.

### Lokal entwickeln
1. Vercel CLI installieren (falls nötig): `npm i -g vercel`
2. Im Repo ausführen: `vercel dev`
3. Umgebungsvariablen lokal setzen (z. B. via `vercel env add` oder `.env.local` für `vercel dev`).
4. App öffnen und im Bereich **Fall-Schmiede (Dev)** die Gemini-Generierung testen.

## Supabase (Login & Online-Speicherung)

### Umgebungsvariablen (Vercel)
- `SUPABASE_URL` **oder** `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY` **oder** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`, optional `GEMINI_MODEL`

Die Vercel-Supabase-Integration legt die `NEXT_PUBLIC_*`-Variablen automatisch an. Der Service-Role-Key wird nicht benötigt und darf nirgends verwendet werden. Nach Änderungen an Variablen neu deployen.

### Datenbank einrichten
1. Im Supabase-Dashboard **SQL Editor** öffnen.
2. Inhalt von `supabase/schema.sql` einfügen und ausführen (Tabellen `medical_cases`, `user_progress` inkl. Row Level Security).

### Authentifizierung
1. **Authentication → Providers → Email** aktivieren.
2. Zum Testen optional **Confirm email** deaktivieren, sonst muss die E-Mail-Adresse nach der Registrierung bestätigt werden.

Ohne Anmeldung (oder ohne Supabase-Konfiguration) arbeitet die App weiter nur mit `localStorage`.

## App lokal ohne API testen

Da es eine statische App ist, kann `index.html` auch direkt im Browser oder über einen einfachen Static-Server geöffnet werden (z. B. `python3 -m http.server`).

## Medizinischer Sicherheitshinweis

KI-generierte Fälle können Fehler enthalten. Inhalte müssen fachlich geprüft werden und sind **keine medizinische Beratung**.