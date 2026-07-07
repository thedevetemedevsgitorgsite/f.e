const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.PUBLIC_SUPA_URL,
  process.env.PUBLIC_SUPA_R_KEY
);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const {
      token,
      seller_id,
      seller_username,
      product_name,
      product_description,
    } = JSON.parse(event.body || "{}");

    // TOKEN CHECK
    if (token !== process.env.APP_UPLOAD_SECRET) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // VALIDATE
    if (!seller_id || !seller_username || !product_name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "seller_id, seller_username, and product_name are required" }),
      };
    }

    // FETCH SUBSCRIBERS
    const { data: subscribers, error: subError } = await supabase
      .from("subscribers")
      .select("subscriber_id")
      .eq("seller_id", seller_id);

    if (subError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: subError.message }),
      };
    }

    if (!subscribers?.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, sent: 0, message: "No subscribers" }),
      };
    }

    // FETCH SUBSCRIBER EMAILS FROM PROFILES
    const subscriberIds = subscribers.map((s) => s.subscriber_id);

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .in("id", subscriberIds).eq("subscription_notify", true);

    if (profileError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: profileError.message }),
      };
    }

    if (!profiles?.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, sent: 0, message: "No subscriber profiles found" }),
      };
    }
          function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

    // MAILER
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });

    await transporter.verify();

    // SEND
    let sent = 0;
    const failed = [];

    
    for (const profile of profiles) {
      if (!profile.email) continue;

    // Pre-escape the variables safely
const safeFullName = escapeHtml(profile.full_name) || "there";
const safeSellerUsername = escapeHtml(seller_username);
const safeProductName = escapeHtml(product_name);

// Escape description text first, then convert newlines to safe <br> tags
const safeProductDescription = product_description 
  ? `<p>${escapeHtml(product_description).replace(/\n/g, "<br>")}</p>` 
  : "";

const listingUrl = `https://devtem.org/s?s=@${safeSellerUsername}`;

const html = `
  <p>Hi ${safeFullName},</p>

  <p>${safeSellerUsername} just published a new listing on DevTemple — <b>${safeProductName}</b>.</p>

  ${safeProductDescription}

  <p>Check it out here:<br>${listingUrl}</p>

  <p style="color:#888;font-size:11px;">You received this because you follow ${safeSellerUsername} on DevTemple. <a href="https://devtem.org/faq#unsubscribe-manage" style="color:#888;">Manage preferences</a>.</p>
`;


      try {
        await transporter.sendMail({
          from: `"DevTemple" <office@devtem.org>`,
          to: profile.email,
          subject: `New listing from ${safeSellerUsername}`,
          html,
        });
        sent++;
      } catch (mailErr) {
        console.error(`Failed sending to ${profile.email}`, mailErr);
        failed.push(profile.email);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: profiles.length,
        sent,
        failed: failed.length,
      }),
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
