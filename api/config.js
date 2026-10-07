// api/config.js - Vercel Serverless Function
export default function handler(req, res) {
    res.status(200).json({
        supabaseUrl: process.env.SUPABASE_URL || "https://fpzpwzkgthgsjubvfblb.supabase.co/rest/v1/",
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "sb_publishable_sYcO0L_nBB0KwecumoqTUw_ZzsvImZ2"
    });
}
