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
      .in("id", subscriberIds);

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

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:2rem;">
          <h2>Hello ${profile.full_name || "there"},</h2>

          <p>You're receiving this because you subscribed to <b>@${seller_username}</b> on DevTemple — and they just uploaded something new. 🔔</p>

          <b>${product_name}</b><br>
          ${product_description ? `<p>${product_description.replace(/\n/g, "<br>")}</p>` : ""}

          <ul>
            <li><a href="https://devtem.org/home#search?=@${seller_username}">Browse @${seller_username}'s full product list</a> to find this product and everything else they've listed</li>
          </ul>

          <b>Show your support:</b>
          <ul>
            <li>Like, comment, or share their post — <b>engagement helps their work reach more people</b></li>
            <li>If this product adds value to your work, <b>a purchase goes a long way</b> in keeping creators like @${seller_username} active on the platform</li>
          </ul>

          <b>Manage your subscriptions:</b>
          <ul>
            <li><a href="https://devtem.org/faq#how-to-subscribe">How subscriptions work on DevTemple</a></li>
            <li><a href="https://devtem.org/faq#creator-subscriber-list">View your full creator subscription list</a></li>
            <li><a href="https://devtem.org/faq#unsubscribe-manage">Unsubscribe or manage your preferences</a></li>
          </ul>

          <hr style="margin:2rem 0;border:none;border-top:1px solid #eee">
          <p style="color:#888;font-size:13px">DevTemple · devtem.org</p>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: `"DevTemple" <office@devtem.org>`,
          to: profile.email,
          subject: `@${seller_username} just uploaded a new product on DevTemple 🔔`,
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
