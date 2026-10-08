/**
 * js/audit.js - Audit / Sync helpers
 * Nutzt den globalen Supabase-Client aus js/auth.js
 */

// WICHTIG: Kein eigenes `let supabaseClient` hier deklarieren!
// Sonst entsteht der Fehler: Identifier 'supabaseClient' has already been declared

function getSupabaseClient() {
    return window.supabaseClient || null;
}

function ensureSession() {
    return window.currentSession || null;
}

async function saveAuditEvent(eventData) {
    const client = getSupabaseClient();
    const session = ensureSession();

    if (!client || !session) return;

    try {
        return await client.from("audit_events").insert({
            user_id: session.user.id,
            event_data: eventData,
            created_at: new Date().toISOString()
        });
    } catch (err) {
        console.error("Audit-Fehler:", err);
    }
}

window.Audit = {
    saveEvent: saveAuditEvent
};
