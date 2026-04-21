// ============================================================
// supabase.js — Supabase Client Initialization
// Credentials are auto-embedded during installation.
// localStorage is used as primary source; embedded defaults as fallback.
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── INSTALLED CONFIG (auto-written by installer — do not edit manually) ──
const INSTALLED_CONFIG = {"https://bvjucnttwxaoqwrsllvk.supabase.co":"","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2anVjbnR0d3hhb3F3cnNsbHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjI2MzEsImV4cCI6MjA5MjMzODYzMX0.mJBDk7D895PPe7izWaiifTVC1UydLuCpknIPwmlruho":"","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2anVjbnR0d3hhb3F3cnNsbHZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc2MjYzMSwiZXhwIjoyMDkyMzM4NjMxfQ.zhq5GqeeO46DmW4ymwvy5RWejBYfcvZoU6XFg0w_cXs":""};
// ── END INSTALLED CONFIG ──

// Read config from localStorage (set by the CMS installer)
const _ls = JSON.parse(localStorage.getItem('supabase_config') || 'null');

// Use localStorage if available and has URL, otherwise fall back to embedded config
const _config = (_ls && _ls.url) ? _ls : INSTALLED_CONFIG;

// If we loaded from embedded config but localStorage is empty, populate localStorage
if ((!_ls || !_ls.url) && INSTALLED_CONFIG.url) {
    localStorage.setItem('supabase_config', JSON.stringify({
        url: INSTALLED_CONFIG.url,
        anon_key: INSTALLED_CONFIG.anon_key,
        service_key: INSTALLED_CONFIG.service_key,
        installed: true,
        installed_at: new Date().toISOString()
    }));
}

const SUPABASE_URL = _config?.url || '';
const SUPABASE_ANON_KEY = _config?.anon_key || '';
const SUPABASE_SERVICE_KEY = _config?.service_key || '';

// Public (anon) client — used for frontend reads & public operations
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin (service_role) client — used for admin CRUD operations
// The service_role key bypasses RLS, so all write operations succeed.
// Only used in admin pages, never exposed on the public frontend.
export const supabaseAdmin = SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : supabase; // fallback to anon if no service key stored

