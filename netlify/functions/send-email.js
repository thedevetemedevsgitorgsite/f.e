const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { recipientEmail, subject, message, token } = JSON.parse(event.body);

    // Token gate — must match MAIL_SEND_TOKEN env var
    if (!token || token !== process.env.MAIL_SEND_TOKEN) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized: Invalid token.' }),
      };
    }

    if (!recipientEmail || !subject || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'recipientEmail, subject, and message are required.' }),
      };
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });

    await transporter.verify();

    const mailOptions = {
      from: `"DevTemple" <office@devtem.org>`,
      to: recipientEmail,
      subject: subject,
      text: message,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
          <div style="border-bottom:2px solid #000;padding-bottom:1rem;margin-bottom:1.5rem;">
            <strong style="font-size:1.2rem;">DevTemple</strong>
            <span style="color:#666;font-size:0.85rem;margin-left:0.5rem;">devtem.org</span>
          </div>
          <p style="white-space:pre-wrap;line-height:1.6;color:#222;">${message.replace(/\n/g, '<br>')}</p>
          <div style="border-top:1px solid #eee;margin-top:2rem;padding-top:1rem;color:#999;font-size:0.8rem;">
            Sent via DevTemple Mail · <a href="https://devtem.org" style="color:#999;">devtem.org</a>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Email sent successfully!' }),
    };

  } catch (error) {
    console.error('Send error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
    };
  }
};
