// netlify/functions/i-verify-paystack.js
// D Invites payment verification – handles Paystack webhook verification,
// updates user subscription in Supabase, and sends a confirmation email.

import { createClient } from '@supabase/supabase-js';

// ── CORS: only these origins can call this function ──
const ALLOWED_ORIGINS = [
  "https://invites.devtem.org",
  "https://thedevetemedevsgitorgsite.github.io",
  "https://devtem.org",
  "http://localhost:7700",
  "https://localhost:7700",
];

const TIER_DAYS = { pro: 30, premium: 30 };
const TIER_LABEL = { pro: 'Pro', premium: 'Premium' };

export const handler = async (event) => {
  const incomingOrigin = event.headers.origin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(incomingOrigin);

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed ? incomingOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // ── OPTIONS preflight ──
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // ── Only POST ──
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // ── Origin check ──
  if (!isAllowed) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized Origin: Access Denied.' }),
    };
  }

  try {
    // ── 1. Get the caller's session token ──
    const authHeader = event.headers.authorization || '';
    const accessToken = authHeader.replace('Bearer ', '');
    if (!accessToken) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing session token' }),
      };
    }

    // ── 2. Verify the token with Supabase ──
    const supabase = createClient(
      process.env.SUPABASE_URL_2,
      process.env.SUPABASE_SECRET_2
    );

    const { data: user, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid session' }),
      };
    }

    // ── 3. Parse request body ──
    const { reference, tier } = JSON.parse(event.body || '{}');
    if (!reference || !tier || !TIER_DAYS[tier]) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing reference or invalid tier' }),
      };
    }

    // ── 4. Verify with Paystack ──
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SEC_KEY}` },
    });
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment verification failed' }),
      };
    }

    // ── 5. Update user's subscription in Supabase ──
    const expiresAt = new Date(Date.now() + TIER_DAYS[tier] * 86400000).toISOString();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_expires_at: expiresAt,
      })
      .eq('id', user.user.id);

    if (updateError) {
      console.error('[verify-paystack] Supabase update error:', updateError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Payment verified but account update failed – contact support.d-invite@devtem.org',
        }),
      };
    }

    // ── 6. Send confirmation email via Brevo (optional) ──
    if (process.env.BREVO_API_KEY) {
      try {
        const paidAmount = (paystackData.data.amount / 100).toLocaleString();
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'D Invites', email: 'support.d-invite@devtem.org' },
            to: [{ email: user.user.email }],
            subject: `You're on ${TIER_LABEL[tier]} – welcome!`,
            htmlContent: `
              <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px">
                <h2 style="margin:0 0 12px">You're upgraded to ${TIER_LABEL[tier]}</h2>
                <p style="color:#555;line-height:1.6">Payment of ₦${paidAmount} confirmed. Your plan is active until ${new Date(expiresAt).toDateString()}.</p>
                <p style="color:#555;line-height:1.6">Reference: <strong>${reference}</strong></p>
                <a href="https://invites.devtem.org/dashboard" style="display:inline-block;margin-top:16px;padding:12px 22px;background:#00E6A0;color:#06120E;text-decoration:none;border-radius:24px;font-weight:700">Go to dashboard</a>
                <p style="font-size:12px;color:#999;margin-top:32px">D Invites · support.d-invite@devtem.org</p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error('[verify-paystack] Email failed:', emailErr);
        // Don't fail the whole request if email fails
      }
    }

    // ── 7. Return success ──
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        tier,
        expires_at: expiresAt,
      }),
    };

  } catch (err) {
    console.error('[verify-paystack] Error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
