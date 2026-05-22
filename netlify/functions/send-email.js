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
    const body = JSON.parse(event.body || "{}");
    const { token, subject, message, audienceType, status, email, full_name } = body;

    // TOKEN CHECK
    if (token !== process.env.MAIL_SEND_TOKEN) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // PROBE — token was valid, no further work needed
    if (body._probe === true) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
      };
    }

    // VALIDATE required fields
    if (!subject || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Subject and message are required" }),
      };
    }

    if (!audienceType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Audience type is required" }),
      };
    }

    // BUILD QUERY — mutually exclusive audience branches
    let query = supabase.from("profiles").select("email, full_name, status");

    if (audienceType === "verified") {
      query = query.eq("status", "verified");

    } else if (audienceType === "single_email") {
      if (!email) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Email is required for single_email audience" }),
        };
      }
      query = query.eq("email", email);

    } else if (audienceType === "status") {
      if (!status) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Status value is required for status audience" }),
        };
      }
      query = query.eq("status", status);

    } else if (audienceType === "full_name") {
      if (!full_name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Full name is required for full_name audience" }),
        };
      }
      query = query.ilike("full_name", `%${full_name}%`);

    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Unknown audience type: ${audienceType}` }),
      };
    }

    const { data: profiles, error: dbError } = await query;

    if (dbError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: dbError.message }),
      };
    }

    if (!profiles?.length) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "No users found for the selected audience" }),
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

    // SEND EMAILS
    let sent = 0;
    const failed = [];

    for (const profile of profiles) {
      if (!profile.email) continue;

      try {
        await transporter.sendMail({
          from: `"DevTemple" <office@devtem.org>`,
          to: profile.email,
          subject,
          text: message,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:2rem;">
              <h2>Hello ${profile.full_name || "User"},</h2>
              <div style="line-height:1.7;color:#222;">
                ${message.replace(/\n/g, "<br>")}
              </div>
              <hr style="margin:2rem 0;border:none;border-top:1px solid #eee">
              <p style="color:#888;font-size:13px">DevTemple · devtem.org</p>
            </div>
          `,
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
