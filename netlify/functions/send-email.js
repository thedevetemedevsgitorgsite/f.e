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
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    const {
      token,
      subject,
      message,
      audienceType,
      status,
      email,
      full_name,
    } = JSON.parse(event.body || "{}");

    // TOKEN CHECK
    if (token !== process.env.MAIL_SEND_TOKEN) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: "Unauthorized",
        }),
      };
    }

    // Probe support
    if (!subject && !message) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
        }),
      };
    }

    // Validate
    if (!subject || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Subject and message required",
        }),
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

    // BUILD QUERY
    let query = supabase
      .from("profiles")
      .select("email, full_name, status");

    // FILTERS

    // Verified users
    if (audienceType === "verified") {
      query = query.eq("status", "verified");
    }

    // By status
    if (status) {
      query = query.eq("status", status);
    }

    // By exact email
    if (email) {
      query = query.eq("email", email);
    }

    // By full name
    if (full_name) {
      query = query.ilike("full_name", `%${full_name}%`);
    }

    const { data: profiles, error } = await query;

    if (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: error.message,
        }),
      };
    }

    if (!profiles?.length) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: "No users found",
        }),
      };
    }

    // SEND EMAILS
    let sent = 0;

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
              
              <h2>
                Hello ${profile.full_name || "User"},
              </h2>

              <div style="line-height:1.7;color:#222;">
                ${message.replace(/\n/g, "<br>")}
              </div>

              <hr style="margin:2rem 0;border:none;border-top:1px solid #eee">

              <p style="color:#888;font-size:13px">
                DevTemple · devtem.org
              </p>

            </div>
          `,
        });

        sent++;

      } catch (mailErr) {
        console.error(
          `Failed sending to ${profile.email}`,
          mailErr
        );
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: profiles.length,
        sent,
      }),
    };

  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};
