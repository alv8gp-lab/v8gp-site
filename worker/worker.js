/**
 * Cloudflare Worker — V8 Nexus Signup Proxy
 * Repo: v8gp-site/worker/worker.js
 *
 * Receives form POST from nexus/index.html
 * Verifies reCAPTCHA, creates ClickUp task with UTM fields
 *
 * Environment variables (set in Cloudflare dashboard — never in code):
 *   CLICKUP_API_KEY      — ClickUp personal API token
 *   CLICKUP_LIST_ID      — Target list ID for Nexus leads
 *   RECAPTCHA_SECRET     — Google reCAPTCHA v2 secret key
 *   ALLOWED_ORIGIN       — https://www.v8gp.co.uk
 */

export default {
  async fetch(request, env) {

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, env);
    }

    const {
      fname, lname, email, business, sector,
      utm_source, utm_medium, utm_campaign, utm_content,
      page_source, captcha
    } = body;

    // ── Basic validation ────────────────────────────────────────────────────
    if (!fname || !email || !business) {
      return jsonResponse({ error: 'Missing required fields' }, 400, env);
    }

    // ── reCAPTCHA verification ──────────────────────────────────────────────
    const captchaValid = await verifyCaptcha(captcha, env.RECAPTCHA_SECRET, request);
    if (!captchaValid) {
      return jsonResponse({ error: 'Captcha verification failed' }, 403, env);
    }

    // ── Build ClickUp task ──────────────────────────────────────────────────
    const fullName = [fname, lname].filter(Boolean).join(' ');
    const taskName = `${business} — ${fullName}`;
    const today = new Date().toISOString().split('T')[0];
    const todayMs = String(Date.now());

    const utmBlock = [
      utm_source    && `UTM Source: ${utm_source}`,
      utm_medium    && `UTM Medium: ${utm_medium}`,
      utm_campaign  && `UTM Campaign: ${utm_campaign}`,
      utm_content   && `UTM Content: ${utm_content}`,
      page_source   && `Page: ${page_source}`,
    ].filter(Boolean).join('\n');

    const description = [
      `📋 V8 Nexus membership interest — ${today}`,
      `Name: ${fullName}`,
      `Email: ${email}`,
      `Business: ${business}`,
      sector && `Sector: ${sector}`,
      '',
      utmBlock || 'No UTM data',
      '',
      'Source: V8 Nexus intro page signup form',
      'Next step: Gina to review and reach out personally',
    ].filter(line => line !== undefined).join('\n');

    const payload = {
      name: taskName,
      description,
      status: 'NEW',
      priority: 3,
      custom_fields: [
        // Contact Name
        { id: 'bad2728a-efa5-4ab3-9250-9f24048605d1', value: fullName },
        // Company Name
        { id: 'c1d661ee-48f6-43f3-a062-f87c7648a670', value: business },
        // Email
        { id: 'd8f07b5a-b49d-4296-8f90-245e302462cf', value: email },
        // Current Situation Summary
        { id: 'c37e5b54-5fee-4fbd-90ac-2ed1f1cbfbb9', value: `${sector || 'Unknown sector'} — Nexus membership interest` },
        // Last Contact
        { id: 'f857cbcf-cf40-4c01-8f0c-22e59791e25b', value: todayMs },
        // Lead Source — Email Campaign default (update ID if Nexus gets its own source)
        { id: 'a6ae9bdd-524e-4b10-b11e-c3fe12e1c3f0', value: ['65967748-5ef5-4547-abec-31a42cea0a97'] },
      ]
    };

    // ── Post to ClickUp ─────────────────────────────────────────────────────
    const clickupRes = await fetch(
      `https://api.clickup.com/api/v2/list/${env.CLICKUP_LIST_ID}/task`,
      {
        method: 'POST',
        headers: {
          'Authorization': env.CLICKUP_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!clickupRes.ok) {
      const err = await clickupRes.text();
      console.error('ClickUp error:', clickupRes.status, err);
      return jsonResponse({ error: 'CRM error — please try again' }, 500, env);
    }

    return jsonResponse({ success: true }, 200, env);
  }
};

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifyCaptcha(token, secret, request) {
  if (!token || !secret) return false;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${secret}&response=${token}&remoteip=${ip}`,
  });
  const data = await res.json();
  return data.success === true;
}

function jsonResponse(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': env?.ALLOWED_ORIGIN || '*',
    }
  });
}
