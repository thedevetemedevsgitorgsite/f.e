import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { reference, email, amount } = body;

    if (!reference || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Missing reference or email",
        }),
      };
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SEC_KEY}`,
        },
      }
    );

    const result = await paystackRes.json();

    if (!result.status || result.data?.status !== "success") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Payment verification failed",
        }),
      };
    }

    const paidAmount = result.data.amount / 100;
    const paidCurrency = result.data.currency || "NGN";

    try {
      await transporter.sendMail({
        from: `"DevTemple Support" <office@devtem.org>`,
        to: email,
        subject: "❤️ Thank you for supporting DevTemple!",
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:20px">
            <div style="text-align:center;margin-bottom:30px">
              <h1 style="margin:0;color:#0066ff">🙏 Thank You!</h1>
              <p style="color:#666;font-size:16px">Your contribution keeps DevTemple alive.</p>
            </div>
            <div style="background:#f8f9ff;padding:20px;border-radius:14px;margin-bottom:20px">
              <p style="font-size:18px;font-weight:700;margin:0 0 8px 0">
                ${paidCurrency} ${paidAmount.toLocaleString()}
              </p>
              <p style="color:#666;margin:0">Payment reference: <strong>${reference}</strong></p>
            </div>
            <p style="color:#555;line-height:1.6">
              Every naira goes directly to hosting and infrastructure costs. You are part of the community that keeps DevTemple running.
            </p>
            <div style="text-align:center;margin-top:30px">
              <a href="https://devtem.org" style="display:inline-block;padding:12px 24px;background:#0066ff;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Visit DevTemple</a>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:40px 0">
            <p style="font-size:12px;color:#999;text-align:center">DevTemple Community ❤️</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Email failed:", emailError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Payment verified and thank-you email sent.",
      }),
    };
  } catch (err) {
    console.error("Paystack support error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || "Internal server error",
      }),
    };
  }
}
