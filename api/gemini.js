const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_PROMPT_LENGTH = 50000;

function sendJson(res, status, payload) {
    return res.status(status).json(payload);
}

function parseRequestBody(body) {
    if (!body) return {};

    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (_error) {
            return null;
        }
    }

    return body;
}

function extractJsonObject(text) {
    if (typeof text !== 'string') {
        throw new Error('Gemini response is not a string.');
    }

    let value = text
        .replace(/^\uFEFF/, '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    try {
        return JSON.parse(value);
    } catch (_error) {
        const firstBrace = value.indexOf('{');
        const lastBrace = value.lastIndexOf('}');

        if (
            firstBrace === -1 ||
            lastBrace === -1 ||
            lastBrace <= firstBrace
        ) {
            throw new Error('No JSON object found in Gemini response.');
        }

        const possibleJson = value.slice(firstBrace, lastBrace + 1);
        return JSON.parse(possibleJson);
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, {
            error: 'Method not allowed. Use POST.'
        });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return sendJson(res, 500, {
            error: 'Server misconfiguration: GEMINI_API_KEY is missing.'
        });
    }

    const parsedBody = parseRequestBody(req.body);

    if (!parsedBody) {
        return sendJson(res, 400, {
            error: 'Invalid JSON body.'
        });
    }

    const prompt =
        typeof parsedBody.prompt === 'string'
            ? parsedBody.prompt.trim()
            : '';

    if (!prompt) {
        return sendJson(res, 400, {
            error: 'Missing "prompt" field.'
        });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
        return sendJson(res, 400, {
            error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} characters.`
        });
    }

    const requestedMedicalField =
        typeof parsedBody.medicalField === 'string'
            ? parsedBody.medicalField.trim()
            : '';

    const medicalField =
        requestedMedicalField ||
        '29.2.10_Erkrankungen des Rückenmarks und des peripheren Nervensystems';

    const model = (
        process.env.GEMINI_MODEL || DEFAULT_MODEL
    ).trim();

    const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent?key=` +
        `${encodeURIComponent(apiKey)}`;

    const instruction = `
const instruction = `Du bist ein erfahrener Facharzt, universitärer Prüfungsbeauftragter für das humanmedizinische Staatsexamen (orientiert an IMPP- und NBME-Standards) und leitender didaktischer Software-Architekt für MedCheck. Deine Aufgabe ist es, aus dem übergebenen Vorlesungsskript bzw. medizinischen Fachtext genau EINEN maximal vollständigen, hochdifferenzierten Fall als syntaktisch valides JSON-Objekt zu generieren.

ZIELGRUPPE & DIDAKTISCHER ANSPRUCH:
- Medizinstudierende im letzten Masterjahr vor dem Staatsexamen.
- Fokus auf Differenzialdiagnosen, pathophysiologische Kausalketten, diagnostische Goldstandards, Leitlinienempfehlungen und klinische Fallstricke (Cognitive Biases, typische Behandlungsfehler).
- Höchste Fachterminologie: Verwende konkrete Fachbegriffe, anatomische Leitstrukturen, exakte Laborparameter (mit Einheiten/Grenzwerten), Bildgebungsmorphologien und Medikamentennamen inklusive Wirkmechanismen.

KRITISCHE TECHNISCHE REGELN FÜR DEN IMPORT (ZERO-TOLERANCE):

1. REINES ROHTEXT-JSON & VOLLSTÄNDIGKEITS-GARANTIE (TRUNCATION-SCHUTZ):
- Antworte AUSSCHLIESSLICH mit dem validen JSON-Objekt.
- Das ALLERERSTE Zeichen deiner Antwort ist { und das ALLERLETZTE Zeichen ist }.
- Absolut KEIN einleitender oder erklärender Text, kein Markdown-Codeblock (keine Backticks, kein json-Label), keine Kommentare davor oder danach.
- Der Text wird direkt an JSON.parse() übergeben.
- Das JSON muss zwingend vollständig generiert werden und syntaktisch geschlossen mit } enden.

2. STRIKTES ZITATIONSVERBOT (LESEFLUSS & DATENBANK-KOMPATIBILITÄT):
- Füge NIEMALS Zitationsmarker, Quellenverweise oder Zitations-Tags wie,, [1], (Quelle: ...) in irgendeinen String oder Task ein.
- Alle Texte müssen reine, flüssige, hochprofessionelle klinische Fachsprache ohne Zitationsartefakte sein.

3. STRING-ESCAPING & TEXTFORMATIERUNG:
- In Fließtexten innerhalb von JSON-Strings sind unescapte doppelte Anführungszeichen STRENG VERBOTEN. Nutze stattdessen einfache Anführungszeichen ('...') oder maskiere sie als \".
- Zeilenumbrüche innerhalb von JSON-Werten dürfen NIEMALS als echte Returns stehen, sondern müssen immer als \\n\\n escaped sein.
- HTML-Gültigkeitsbereich: HTML-Tags (<p>, <b>, <ul>, <li>) sind ausschließlich im Feld case_overview.cornell_notes[].notes gestattet. Alle übrigen Felder (summary, content, hotspots, hints, cascades, explanation etc.) sind ausnahmslos reiner Plain-Text.

4. CASE_OVERVIEW (MAXIMALE VOLLSTÄNDIGKEIT, SYNCHRONISIERTE CUES & INTENSIVE FETTMARKIERUNG):
- case_overview.cornell_notes:
  - MUSS ALLE im übergebenen Skript oder Text vorkommenden Themenblöcke, Entitäten, Anatomie-Details, physiologischen Funktionen, Leitsymptome, Diagnostik- und Therapieschemata lückenlos abdecken – egal wie umfangreich die Sektion wird.
  - HÖHEN-SYNCHRONISATION DER ÜBERSCHRIFTEN / CUES: Die Stichworte/Überschriften im Array cues müssen strikt auf der vertikalen Höhe stehen, wo die jeweilige Information im Text zu finden ist. Strukturiere jeden Eintrag daher feingranular oder spiegele die Absätze/Bulletpoints im Text exakt 1:1 durch die Reihenfolge der Cues wider (Cue 1 korrespondiert mit Absatz/Bullet 1, Cue 2 mit Absatz/Bullet 2 usw.).
  - INTENSIVE FETTMARKIERUNG: Alle wichtigen Inhalte, klinischen Schlüsselbegriffe, Grenzwerte, Leitstrukturen, Goldstandards, Erregernamen, Medikamente, Warnzeichen ('Cave') und Leitsymptome MÜSSEN im Fließtext konsequent fett hervorgehoben werden (mittels <b>...</b>).
  - cues: Präzise, hochspezifische Fachbegriffe und Kernaspekte als Array von Strings.
  - notes: Ausführliche HTML-Darstellung mit <p>, <b>Schlüsselbegriffen</b> und detaillierten <ul><li>Aufzählungspunkten</li></ul>, die Faktenwissen, pathophysiologische Zusammenhänge, Leitlinien und klinische Pearls maximal tief und vollständig ausarbeiten.
- case_overview.summary:
  - Reiner Plain-Text (kein HTML).
  - Eine vollständige, mehrdimensionale Synthese aller im Fall und in den Vorlesungsinhalten behandelten Pathologien, pathophysiologischen Mechanismen und klinischen Entscheidungsknoten.

5. AUDIT & TIMELINE (9 SCHRITTE – 70 BIS 160 WÖRTER PRO SCHRITT):
- REINER PLAIN-TEXT IN "content": Absolut keine HTML-Tags (<p>, <b> etc.) in timeline[].content.
- SUBSTANZ & WORTKORRIDOR: Jeder Schritt ist ein realistischer klinischer Verlaufsbericht mit 70 bis 160 Wörtern pro Schritt mit Vitalparametern, Vorerkrankungen und Begründungen des Teams.
- STRIKTE TRENNUNG DER PATIENTEN:
  - Schritt 1 bis 3 = Patient 1. Schritt 1 beginnt zwingend mit: "Patient 1\\n\\n[Text]"
  - Schritt 4 bis 6 = Patient 2. Schritt 4 beginnt zwingend mit: "Patient 2\\n\\n[Text]"
  - Schritt 7 bis 9 = Patient 3. Schritt 7 beginnt zwingend mit: "Patient 3\\n\\n[Text]"
- PHASEN-BEZEICHNUNGEN (Neutral, ohne Spoiler):
  - "Patient 1: Anamnese & Erstkontakt", "Patient 1: Diagnostik & Befunde", "Patient 1: Therapie & Verlauf"
  - "Patient 2: Anamnese & Erstkontakt", "Patient 2: Diagnostik & Befunde", "Patient 2: Therapie & Verlauf"
  - "Patient 3: Anamnese & Erstkontakt", "Patient 3: Diagnostik & Befunde", "Patient 3: Therapie & Verlauf"
- HOTSPOTS (EXAKTER SUBSTRING-MATCH):
  - Jede phrase MUSS ein exakter, zeichengenauer Substring aus content sein (2 bis 6 Wörter, keine Satzzeichen am Anfang/Ende der Phrase), damit content.indexOf(phrase) im Frontend immer >= 0 liefert.
  - Mindestens 3 bis 5 Schritte enthalten echte Behandlungsfehler (is_error: true).
  - Fehlerhafte Hotspots (is_error: true) benötigen zwingend: { "phrase": "exakter Textausschnitt", "is_error": true, "socratic_trap": "Sokratischer Impuls (lenkende Frage/Tipp, keine Lösung)", "correct_pathophysiology": "Fundierte Erklärung, warum Maßnahme falsch ist und wie es evidenzbasiert lauten muss" }
  - Korrekte Hotspots / Distraktoren (is_error: false): { "phrase": "exakter Textausschnitt", "is_error": false, "feedback": "Diese Feststellung ist im klinischen Kontext fachlich vollkommen korrekt." }

6. DOCTORDLE (ORIGINALES DEDUKTIONSPRINZIP – PROGRESSIVE HINWEISE OHNE FRÜH-SPOILER):
- extra_tasks.doctordle ist ein Array mit genau 3 Objekten (puzzle_id: 1, 2, 3).
- Jedes Rätsel behandelt eine zentrale Zielerkrankung des Themas (sollte sich mit synapses_matrix und clinical_cascades überschneiden).
- TITEL-KONVENTION: Der Titel lautet schlicht und standardisiert genau "Fall 1", "Fall 2" bzw. "Fall 3". Absolut keine Zusätze, Diagnosenamen oder Untertitel.
- ECHTES DOCTORDLE-PRINZIP: Hinweise müssen subtil und deduktiv aufgebaut sein. Verrate niemals zu früh die Lösung durch offensichtliche Reizwörter. Die Diagnose muss schrittweise progressiv erschlossen werden:
  - Hinweis 1 (Demografie & unspezifisches Leitsymptom): Alter/Geschlecht, sehr allgemeines Hauptsymptom. Lässt ein breites Spektrum an Differenzialdiagnosen offen.
  - Hinweis 2 (Körperlicher Untersuchungsbefund / Phänotyp): Objektiver Befund, der mehrere Erkrankungen einschließt.
  - Hinweis 3 (Basislabor oder Vitalparameter): Unspezifische laborchemische Auffälligkeit oder Vitalwert.
  - Hinweis 4 (Differenzialdiagnostische Weichenstellung / Funktionstest / Kontext): Befund, der das Spektrum stark einengt, ohne die Diagnose direkt zu nennen.
  - Hinweis 5 (Spezifischer Befund / Bildgebung): Spezifischer bildgebender oder morphologischer Befund.
  - Hinweis 6 (Pathognomonischer Schlüsselbefund / Goldstandard): Erst HIER folgt der nahezu beweisende Befund.
- Jedes Rätsel enthält: puzzle_id (1, 2 oder 3), title ("Fall 1", "Fall 2", "Fall 3"), target_diagnosis, synonyms (3–6 valide Schreibweisen/Synonyme), hints (genau 6 Strings), learning_pearl (1–2 Sätze Kausalität).

7. LIBRARY_ENTRIES:
- Array aus mindestens 15 bis 20 Strings: Enthält alle 3 target_diagnoses, sämtliche zugehörigen synonyms und 8 bis 12 klinisch bedeutsame Differenzialdiagnosen für das fallübergreifende Autocomplete-Wörterbuch.

8. ANSPRUCHSVOLLE TAXONOMIE (KEINE GENERISCHEN BINS):
- Unter extra_tasks.categorization geht es um die klinische Zuordnung von spezifischen Befunden, Manövern, Mustern oder Pathologien zu konkreten Krankheitsentitäten, anatomischen Kompartimenten oder pathophysiologischen Syndromen.
- VERBOTEN sind triviale, generische Kategorien wie "Diagnostik", "Symptom", "Therapie", "Risiko".
- categories: Genau 3 bis 4 spezifische Krankheitsentitäten oder pathophysiologische Kategorien des Themas.
- items: 8 bis 12 spezifische, anspruchsvolle Befunde, Manöver, Nystagmusmuster oder Kausalzusammenhänge, die jeweils eindeutig einer der definierten Krankheits-/Syndrom-Kategorien zugeordnet werden müssen.

9. CASCADES, SYNAPSEN & MASTER QUIZ (IMPP- & NBME-STANDARDS, TYP A, 1 AUS 5):
- clinical_cascades: Genau 3 Erkrankungen mit je 8 Stufen (01_Auslöser bis 08_Outcome). Feld tutor_hint heißt rein "Hinweis".
- synapses_matrix: Genau 4 Erkrankungen à 4 Variablen = 16 Variablen (Typen: "Risiko/Pathologie", "Symptom/Klinik", "Diagnostik", "Therapie/Management"). Feld tutor_hint heißt rein "Hinweis".
- categorization: Feld tutor_hint heißt rein "Hinweis".
- master_quiz: Mindestens 5 Multiple-Choice-Fragen (Typ A, 1 aus 5) mit hohem diskriminatorischem Wert:

  A. INHALTLICHE ANFORDERUNGEN (Bloom-Taxonomie Level 3–5):
- Jede Frage basiert auf einer realistischen Fallvignette (Symptome, Vitalparameter, Labor/Bildgebung) oder komplexen pathophysiologischen Vorgängen mit präziser Leitfrage am Ende des "question"-Strings.
- Zweistufiger Denkschritt ("Two-step reasoning": z. B. Befunde synthetisieren -> Verdachtsdiagnose -> nächste therapeutische Maßnahme oder pharmakologischer Wirkmechanismus).
- Keine reinen Faktenabfragen ("First-Order Recall").

  B. ANTI-BIAS-PROTOKOLL GEGEN TEST-WISENESS (STRIKTE UMSETZUNG):
1. Kontrollierte Längenparität (10–15 % Zeichenvarianz):
  - Alle 5 Antwortoptionen (A bis E bzw. Index 0 bis 4) bewegen sich in einem ausgewogenen Korridor von ca. 10–15 % Zeichenvarianz.
  - Flexibilität des Ensembles: Das gesamte Set der Optionen kann je nach Fragestellung kurz oder ausführlich formuliert sein. Wichtig ist die interne Homogenität innerhalb der Frage.
  - Echte Unvorhersehbarkeit: Die korrekte Antwort folgt keinem Längenmuster.
2. Syntaktische Homogenität & Begründungsverbot:
  - Alle 5 Optionen teilen denselben grammatikalischen Typus.
  - Keine Begründungssätze ("um zu...", "weil...") in einzelnen Optionen.
3. Hochwertige klinische Distraktoren:
  - Relevante Differenzialdiagnosen, typische Denkfallen oder kontraindizierte Maßnahmen.
4. Test-Wiseness-Verbote:
  - Keine Signalwörter wie "immer", "nie". Keine Meta-Optionen ("Alle genannten").
5. Randomisierte Schlüsselverteilung:
  - Die korrekte Option wird zwingend zufällig auf Index 0, 1, 2, 3 oder 4 platziert (correct_index).

  C. DIDAKTISCHE RATIONALE & FEEDBACK:
- "explanation": Expliziter Zeichenvergleich aller 5 Optionen zur Bestätigung der 10–15 % Varianz, fundierte Rationale für die korrekte Option sowie dezidierte klinische Entkräftung JEDES einzelnen Distraktors (keine Wiederholung des Falltextes).
- "hint": Rein "Hinweis" (nicht "tutor_hint" oder "sokratischer Hinweis"). Ein zielgerichteter, didaktischer Impuls zur Leitsymptomatik oder Pathophysiologie ohne Spoiler der Lösung.

JSON-SCHEMA (STRUKTURBEISPIEL):
{
  "case_id": "STRING_IDENTIFIER",
  "metadata": {
    "title": "STRING",
    "medical_field": "STRING",
    "bloom_level": "Evaluation & Synthese",
    "difficulty": 5,
    "xp_reward": 1200
  },
  "case_overview": {
    "topic": "STRING",
    "cornell_notes": [
      {
        "cues": ["Schlüsselbegriff 1", "Schlüsselbegriff 2"],
        "notes": "<p>Fundierte Erklärung mit <b>wichtigen Inhalten immer fett</b>.</p><ul><li><b>Aspekt 1:</b> Wichtige Details fett markiert.</li><li><b>Aspekt 2:</b> Höhen-Synchronisation zu Cue 2.</li></ul>"
      }
    ],
    "summary": "STRING"
  },
  "timeline": [
    {
      "step_id": 1,
      "patient_id": "patient_1",
      "phase": "Patient 1: Anamnese & Erstkontakt",
      "content": "Patient 1\\n\\nAusführlicher Plain-Text Bericht ohne HTML (70-160 Wörter)...",
      "hotspots": [
        {
          "phrase": "exakter Textteil",
          "is_error": false,
          "feedback": "Diese Feststellung ist im klinischen Kontext fachlich vollkommen korrekt."
        }
      ]
    }
  ],
  "extra_tasks": {
    "doctordle": [
      {
        "puzzle_id": 1,
        "title": "Fall 1",
        "target_diagnosis": "Diagnose A",
        "synonyms": ["Synonym 1", "Synonym 2", "Synonym 3"],
        "hints": [
          "Hinweis 1: ...",
          "Hinweis 2: ...",
          "Hinweis 3: ...",
          "Hinweis 4: ...",
          "Hinweis 5: ...",
          "Hinweis 6: ..."
        ],
        "learning_pearl": "Prägnante Kernaussage zur Diagnosefindung."
      },
      {
        "puzzle_id": 2,
        "title": "Fall 2",
        "target_diagnosis": "Diagnose B",
        "synonyms": ["Synonym 1", "Synonym 2", "Synonym 3"],
        "hints": [
          "Hinweis 1: ...",
          "Hinweis 2: ...",
          "Hinweis 3: ...",
          "Hinweis 4: ...",
          "Hinweis 5: ...",
          "Hinweis 6: ..."
        ],
        "learning_pearl": "Kernaussage B."
      },
      {
        "puzzle_id": 3,
        "title": "Fall 3",
        "target_diagnosis": "Diagnose C",
        "synonyms": ["Synonym 1", "Synonym 2", "Synonym 3"],
        "hints": [
          "Hinweis 1: ...",
          "Hinweis 2: ...",
          "Hinweis 3: ...",
          "Hinweis 4: ...",
          "Hinweis 5: ...",
          "Hinweis 6: ..."
        ],
        "learning_pearl": "Kernaussage C."
      }
    ],
    "library_entries": [
      "Diagnose A",
      "Diagnose B"
    ],
    "clinical_cascades": [
      {
        "disease": "Erkrankung A",
        "hint": "Hinweis zum pathophysiologischen Ablauf",
        "cascade": [
          { "stage": "01_Auslöser", "content": "..." },
          { "stage": "02_Pathophysiologie", "content": "..." },
          { "stage": "03_Zellulärer Mechanismus", "content": "..." },
          { "stage": "04_Anatomische Konsequenz", "content": "..." },
          { "stage": "05_Klinische Manifestation", "content": "..." },
          { "stage": "06_Diagnostischer Befund", "content": "..." },
          { "stage": "07_Therapeutische Intervention", "content": "..." },
          { "stage": "08_Outcome", "content": "..." }
        ]
      }
    ],
    "synapses_matrix": {
      "description": "Ordne jeweils vier Begriffe derselben Erkrankung zu.",
      "hint": "Verbinde Risiko/Pathologie, Symptom/Klinik, Diagnostik und Therapie/Management.",
      "diseases": ["Erkrankung A", "Erkrankung B", "Erkrankung C", "Erkrankung D"],
      "variables": [
        {
          "term": "Spezifischer Terminus",
          "type": "Risiko/Pathologie",
          "disease": "Erkrankung A"
        }
      ]
    },
    "categorization": {
      "description": "Ordne die klinischen Befunde, Manöver und Phänomene den entsprechenden Krankheitsbildern zu.",
      "hint": "Differenziere die pathognomonischen Befunde der einzelnen Entitäten.",
      "categories": [
        "Krankheitsbild A",
        "Krankheitsbild B",
        "Krankheitsbild C",
        "Krankheitsbild D"
      ],
      "items": [
        {
          "term": "Spezifischer Befund oder Manöver",
          "category": "Krankheitsbild A"
        }
      ]
    },
    "master_quiz": [
      {
        "question": "Detaillierte Fallvignette mit klinischer Leitsymptomatik, Vitalparametern, Labor/Befunden und präziser klinischer Leitfrage...",
        "options": [
          "Option A",
          "Option B",
          "Option C",
          "Option D",
          "Option E"
        ],
        "correct_index": 2,
        "explanation": "Zeichenvergleich:\\n- Option A: 48 Z.\\n- Option B: 49 Z.\\n- Option C: 47 Z.\\n- Option D: 46 Z.\\n- Option E: 48 Z.\\n(Maximale Varianz: 6.2 %)\\n\\nFundierte Rationale für Option C: [...]\\n\\nKlinische Analyse der Distraktoren:\\n- Option A: [...]\\n- Option B: [...]\\n- Option D: [...]\\n- Option E: [...]",
        "hint": "Hinweis zur Leitsymptomatik oder Pathophysiologie ohne Spoiler."
      }
    ]
  }
}`;

        const upstreamText = await upstream.text();

        let upstreamJson = null;

        try {
            upstreamJson = upstreamText
                ? JSON.parse(upstreamText)
                : null;
        } catch (_error) {
            return sendJson(res, 502, {
                error: 'Gemini API returned a non-JSON response.',
                upstreamStatus: upstream.status,
                rawResponse: upstreamText.slice(0, 2000)
            });
        }

        if (!upstream.ok) {
            const upstreamMessage =
                upstreamJson?.error?.message ||
                upstreamJson?.message ||
                `Gemini API request failed with status ${upstream.status}.`;

            return sendJson(res, 502, {
                error: upstreamMessage,
                upstreamStatus: upstream.status
            });
        }

        const generatedText = upstreamJson?.candidates?.[0]?.content?.parts
            ?.map(part =>
                typeof part?.text === 'string'
                    ? part.text
                    : ''
            )
            .join('')
            .trim();

        if (!generatedText) {
            return sendJson(res, 502, {
                error: 'Gemini returned no usable content.',
                finishReason:
                    upstreamJson?.candidates?.[0]?.finishReason || null
            });
        }

        let generatedCase;

        try {
            generatedCase = extractJsonObject(generatedText);
        } catch (error) {
            return sendJson(res, 502, {
                error: 'Gemini returned invalid JSON.',
                details: error.message,
                finishReason:
                    upstreamJson?.candidates?.[0]?.finishReason || null,
                rawResponse: generatedText.slice(0, 4000)
            });
        }

        if (
            !generatedCase ||
            typeof generatedCase !== 'object' ||
            Array.isArray(generatedCase)
        ) {
            return sendJson(res, 502, {
                error: 'Gemini response is not a JSON object.'
            });
        }

        if (
            !generatedCase.case_id ||
            !generatedCase.metadata ||
            !Array.isArray(generatedCase.timeline)
        ) {
            return sendJson(res, 502, {
                error: 'Gemini JSON is missing required fields.'
            });
        }

        generatedCase.metadata.medical_field = medicalField;

        return sendJson(res, 200, {
            ok: true,
            model,
            generatedText: JSON.stringify(generatedCase),
            generatedCase
        });
    } catch (error) {
        console.error('Gemini API error:', error);

        return sendJson(res, 500, {
            error: 'Unexpected server error while contacting Gemini.',
            details: error?.message || 'Unknown error'
        });
    }
};
