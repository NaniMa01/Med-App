const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_PROMPT_LENGTH = 10000;

function sendJson(res, status, payload) {
    res.status(status).json(payload);
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

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return sendJson(res, 500, { error: 'Server misconfiguration: GEMINI_API_KEY is missing.' });
    }

    const parsedBody = parseRequestBody(req.body);
    if (!parsedBody) {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }

    const prompt = typeof parsedBody.prompt === 'string' ? parsedBody.prompt.trim() : '';
    if (!prompt) {
        return sendJson(res, 400, { error: 'Missing "prompt" field.' });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
        return sendJson(res, 400, { error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} characters.` });
    }

    const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const instruction = `Erzeuge genau EINEN medizinischen Fall als reines JSON-Objekt ohne Markdown. Verwende dieses Schema:
- {
-   "case_id": "STRING",
-   "metadata": { "title": "STRING", "medical_field": "STRING", "bloom_level": "STRING", "difficulty": NUMBER(1-5), "xp_reward": NUMBER },
-   "timeline": [
-     {
-       "step_id": NUMBER,
-       "phase": "STRING",
-       "content": "STRING mit [markierten] Phrasen für Hotspots",
-       "hotspots": [
-         {
-           "phrase": "STRING exakt wie in content",
-           "is_error": BOOLEAN,
-           "skill_tag": "Triage|Diagnostics|Pharmacology|Pathophysiology|Diagnostik|Pharmakologie|Pathophysiologie",
-           "feedback": "STRING (bei is_error=false)",
-           "socratic_trap": "STRING (bei is_error=true)",
-           "correct_pathophysiology": "STRING (bei is_error=true)"
-         }
-       ]
-     }
-   ]
- }
- Wichtig: Gib ausschließlich gültiges JSON zurück, ohne zusätzliche Erklärungen. Thema/Prompt: ${prompt}`;

+    const instruction = `
+Du bist ein Elite-Software-Architekt, Full-Stack-Entwickler und EdTech-Experte
+für hochskalierbare, gamifizierte medizinische Lern-Apps.
+
+Du bist außerdem Elite-Facharzt und didaktischer Content-Architekt für einen
+sokratischen Morbidity-&-Mortality-Simulator auf universitärem Master-Niveau.
+
+AUFGABE:
+Verarbeite den folgenden Rohtext aus einer medizinischen Vorlesung, Leitlinie
+oder wissenschaftlichen Publikation. Extrahiere das pathophysiologische
+Kernwissen und erstelle daraus genau EINEN hochkomplexen klinischen Fall.
+
+Der Output muss ausschließlich ein gültiges JSON-Objekt sein.
+Kein Markdown, keine Code-Fences, keine Einleitung und keine Erklärung außerhalb
+des JSON-Objekts.
+
+VERBINDLICHE DESIGNREGELN:
+
+1. medical_field:
+   Verwende exakt einen Namen aus dieser Liste:
+   ${JSON.stringify([
+       "29.2.10_Erkrankungen des Rückenmarks und des peripheren Nervensystems"
+       // Hier alle tatsächlichen Ordnernamen ergänzen.
+   ])}
+   Erfinde niemals neue Ordnernamen.
+
+2. case_overview:
+   Erstelle zwingend ein case_overview-Objekt direkt nach metadata.
+   Es muss dem Cornell-Notizen-Format entsprechen:
+   - topic: Hauptthema
+   - cornell_notes: Array mit mindestens 4 Notiz-Blöcken
+   - Jeder Block enthält cues und notes
+   - notes müssen tiefe pathophysiologische und diagnostische Erklärungen
+     enthalten und dürfen HTML-Tags wie <strong>, <ul> und <li> verwenden
+   - summary: prägnante Take-Home-Message
+
+3. timeline:
+   Erstelle exakt 9 Timeline-Schritte:
+   - Patient 1: Schritte 1 bis 3
+   - Patient 2: Schritte 4 bis 6
+   - Patient 3: Schritte 7 bis 9
+   Jeder Patient muss klinisch mit den anderen Fällen verbunden sein.
+
+4. Signal versus Noise:
+   Markiere klinisches Rauschen, Fehlinformationen und kritische Aussagen
+   innerhalb von content mit eckigen Klammern, zum Beispiel:
+   "[Die Beschwerden werden als rein psychogen eingeordnet.]"
+   Jeder markierte Hotspot muss exakt in content vorkommen und ein skill_tag
+   besitzen.
+
+5. Null-Fehler-Falle:
+   Jeder Patient muss mindestens einen Hotspot mit is_error=false enthalten.
+   Diese Hotspots müssen vollständig korrekt und klinisch begründet sein.
+
+6. Sokratische Falle:
+   Für jeden Hotspot mit is_error=true müssen vorhanden sein:
+   - socratic_trap
+   - correct_pathophysiology
+   Die Erklärung muss mechanistisch und kritisch sein.
+
+7. Clinical Cascades:
+   Erstelle für jede im Fall behandelte Erkrankung eine Clinical Cascade
+   mit exakt 8 kausal verbundenen Stufen.
+
+8. Extra Tasks:
+   Jede Aufgabe in extra_tasks muss ein tutor_hint enthalten.
+
+9. Synapsen-Matrix:
+   Verwende exakt diese vier Kategorien:
+   - Risiko/Pathologie
+   - Symptom/Klinik
+   - Diagnostik
+   - Therapie/Management
+
+10. Master-Exam:
+    Erstelle zwischen 5 und 10 anspruchsvolle Multiple-Choice-Fragen.
+    Jede Frage braucht:
+    - question
+    - options mit A, B, C, D und optional E
+    - correct_answer
+    - explanation
+    - tutor_hint
+
+VERWENDES JSON-SCHEMA:
+{
+  "case_id": "eindeutige stabile ID",
+  "metadata": {
+    "title": "STRING",
+    "medical_field": "STRING aus der erlaubten Ordnerliste",
+    "bloom_level": "Evaluation & Synthese",
+    "difficulty": 5,
+    "xp_reward": 900
+  },
+  "case_overview": {
+    "topic": "STRING",
+    "cornell_notes": [
+      {
+        "cues": ["STRING", "STRING", "Was?", "Warum?"],
+        "notes": "HTML-formatierte, detaillierte Erklärung"
+      }
+    ],
+    "summary": "STRING"
+  },
+  "timeline": [
+    {
+      "step_id": 1,
+      "patient_id": "patient_1",
+      "phase": "STRING",
+      "content": "STRING mit markierten Hotspots in eckigen Klammern",
+      "hotspots": [
+        {
+          "phrase": "exakter Wortlaut aus content",
+          "is_error": true,
+          "skill_tag": "Triage|Diagnostics|Pharmacology|Pathophysiology|Diagnostik|Pharmakologie|Pathophysiologie",
+          "feedback": "Nur bei is_error=false verwenden",
+          "socratic_trap": "Nur bei is_error=true verwenden",
+          "correct_pathophysiology": "Nur bei is_error=true verwenden"
+        }
+      ]
+    }
+  ],
+  "extra_tasks": {
+    "clinical_cascades": [
+      {
+        "disease": "STRING",
+        "steps": [
+          {
+            "step": 1,
+            "title": "STRING",
+            "description": "STRING"
+          },
+          {
+            "step": 2,
+            "title": "STRING",
+            "description": "STRING"
+          },
+          {
+            "step": 3,
+            "title": "STRING",
+            "description": "STRING"
+          },
+          {
+            "step": 4,
+            "title": "STRING",
+            "description": "STRING"
+          },
+          {
+            "step": 5,
+            "title": "STRING",
+            "description": "STRING"
+          },
+          {
+            "step": 6,
+            "title": "STRING",
+            "description": "STRING"
+          },
+          {
+            "step": 7,
+            "title": "STRING",
+            "description": "STRING"
+          },
+          {
+            "step": 8,
+            "title": "STRING",
+            "description": "STRING"
+          }
+        ],
+        "tutor_hint": "STRING"
+      }
+    ],
+    "synapses_matrix": {
+      "Risiko/Pathologie": [],
+      "Symptom/Klinik": [],
+      "Diagnostik": [],
+      "Therapie/Management": []
+    },
+    "master_quiz": [
+      {
+        "question": "STRING",
+        "options": {
+          "A": "STRING",
+          "B": "STRING",
+          "C": "STRING",
+          "D": "STRING",
+          "E": "STRING"
+        },
+        "correct_answer": "A",
+        "explanation": "STRING",
+        "tutor_hint": "STRING"
+      }
+    ]
+  }
+}
+
+WICHTIGE VALIDIERUNGEN VOR DER AUSGABE:
+- Genau 9 Timeline-Schritte erzeugen.
+- Genau 3 Patienten verwenden.
+- Jeder Patient erhält genau 3 Schritte.
+- Jeder Patient erhält mindestens einen Hotspot mit is_error=false.
+- Jede Hotspot-phrase muss exakt in content vorkommen.
+- clinical_cascades müssen immer exakt 8 Schritte enthalten.
+- master_quiz muss 5 bis 10 Fragen enthalten.
+- Alle Pflichtfelder müssen vorhanden sein.
+- Gib ausschließlich gültiges JSON zurück.
+
+ROHTEXT / THEMA:
+${prompt}
+`;
Wichtig: Gib ausschließlich gültiges JSON zurück, ohne zusätzliche Erklärungen. Thema/Prompt: ${prompt}`;

    try {
        const upstream = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: instruction }] }],
                generationConfig: {
                    temperature: 0.3,
                    responseMimeType: 'application/json'
                }
            })
        });

        const upstreamText = await upstream.text();
        let upstreamJson = null;
        try {
            upstreamJson = upstreamText ? JSON.parse(upstreamText) : null;
        } catch (_error) {}

        if (!upstream.ok) {
            const upstreamMessage =
                upstreamJson?.error?.message ||
                upstreamJson?.message ||
                `Gemini API request failed with status ${upstream.status}.`;
            return sendJson(res, 502, { error: upstreamMessage, upstreamStatus: upstream.status });
        }

        const generatedText = upstreamJson?.candidates?.[0]?.content?.parts
            ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('')
            .trim();

        if (!generatedText) {
            return sendJson(res, 502, { error: 'Gemini returned no usable content.' });
        }

        return sendJson(res, 200, {
            ok: true,
            model,
            generatedText
        });
    } catch (error) {
        return sendJson(res, 500, {
            error: 'Unexpected server error while contacting Gemini.',
            details: error?.message || 'Unknown error'
        });
    }
};
