import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPA_URL,
  process.env.PUBLIC_SUPA_R_KEY
);

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

function maskEmail(email) {
  if (!email) return "Unknown";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const [domainName, tld] = domain.split(".");
  return `${user.slice(0, 2)}***@${domainName.slice(0, 2)}***.${tld}`;
}

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

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    await transporter.verify();
    
    const body = JSON.parse(event.body || "{}");
    const { userId, walletSource, totalAmount, rewId, cart } = body;

    if (!userId || !walletSource || !totalAmount || !cart || cart.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required checkout parameters" }),
      };
    }

    // 1. Fetch Buyer's email to authorize the RPC context profile mappings
    const { data: buyerProfile, error: buyerError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (buyerError || !buyerProfile) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Buyer profile record not found" }),
      };
    }

    const buyerEmail = buyerProfile.email;
    let downloadLinks = [];

    console.log(`Starting wallet checkout for ${buyerEmail} using ${walletSource} wallet...`);

    // 2. Route transactional payments inside a loop for each content creator inside the cart setup
    for (const item of cart) {
      try {
        if (!item?.id || !item?.sellerId || !item?.price) {
          console.log("Skipping invalid cart item:", item);
          continue;
        }

        const itemPrice = Number(item.price);
        if (itemPrice <= 0) continue;

        // Execute the secure PostgreSQL database transaction function
        const { data: rpcData, error: rpcError } = await supabase.rpc("wallet_transfer", {
          p_sender_id: userId,
          p_recipient_id: item.sellerId,
          p_amount: itemPrice,
          p_wallet_source: walletSource,
          p_note: `Purchase: ${item.title}`
        });

        if (rpcError || !rpcData?.success) {
          console.error("RPC execution error:", rpcError, rpcData);
          throw new Error(rpcData?.error || rpcError?.message || "Internal ledger transfer rejection.");
        }

        // 3. Update the product sales metrics counter
        const { data: post, error: postError } = await supabase
          .from("posts")
          .select("sales, name, filePath")
          .eq("id", item.id)
          .single();

        if (!postError && post) {
          const newSales = (post.sales || 0) + 1;
          await supabase.from("posts").update({ sales: newSales }).eq("id", item.id);

          // 4. Calculate Referral Commissions (Skip self-referrals)
          if (rewId && rewId !== item.sellerId) {
            const { data: refProfile } = await supabase
              .from("profiles")
              .select("id, status")
              .eq("id", rewId)
              .single();

            if (refProfile) {
              const rewardAmount = refProfile.status === "verified" ? itemPrice * 0.1 : itemPrice * 0.07;
              await supabase.from("rew").insert({
                user_id: rewId,
                amount: rewardAmount,
                product_title: item.title || post.name || "Untitled Product",
                source: null,
                country: null
              });
            }
          }
        }

        // 5. Notify the Creator (Seller) about the execution sale
        const { data: sellerProfile } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", item.sellerId)
          .single();

        if (sellerProfile?.email) {
          try {
            await transporter.sendMail({
              from: `"DevTemple" <office@devtem.org>`,
              to: sellerProfile.email,
              subject: `🎉 You just made a sale via Wallet on DevTemple!`,
              html: `
                <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
                  <h2 style="color:#111">You made a sale! 🎉</h2>
                  <p>Hi ${sellerProfile.full_name || "there"},</p>
                  <p>Your product <strong>${item.title || "Untitled Product"}</strong> was purchased using a wallet balance.</p>
                  <table style="width:100%;border-collapse:collapse;margin:1rem 0">
                    <tr><td style="padding:8px;color:#555">Product</td><td style="padding:8px"><strong>${item.title || "Untitled Product"}</strong></td></tr>
                    <tr style="background:#f9f9f9"><td style="padding:8px;color:#555">Amount</td><td style="padding:8px"><strong>₦${itemPrice.toLocaleString()}</strong></td></tr>
                    <tr><td style="padding:8px;color:#555">Buyer</td><td style="padding:8px">${maskEmail(buyerEmail)}</td></tr>
                  </table>
                  <p><a href="https://devtem.org/dashboard">View dashboard →</a></p>
                  <hr style="border:none;border-top:1px solid #eee;margin:2rem 0">
                  <p style="color:#999;font-size:0.85rem">DevTemple</p>
                </div>
              `,
            });
          } catch (emailErr) {
            console.error(`Seller email failed:`, emailErr);
          }
        }

        // Admin support email auditing
        if (sellerProfile) {
          try {
            await transporter.sendMail({
              from: `"DevTemple" <office@devtem.org>`,
              to: "support@devtem.org",
              subject: `🎉 Wallet Purchase Success Audit Log`,
              html: `<p>ID: ${sellerProfile.id} | Name: ${sellerProfile.full_name || "User"} sold <strong>${item.title}</strong> to ${buyerEmail} for ₦${itemPrice}.</p>`,
            });
          } catch (auditErr) {
            console.error("Admin audit log mail dropped", auditErr);
          }
        }

        // 6. Generate secure time-sensitive signed file downloads 
        const targetPath = item.filePath || post?.filePath;
        if (targetPath) {
          const { data: signedUrl, error: signedUrlError } = await supabase.storage
            .from("uploads")
            .createSignedUrl(targetPath, 60 * 60 * 24);

          if (!signedUrlError && signedUrl?.signedUrl) {
            downloadLinks.push({
              id: item.id,
              title: item.title || "Download Link",
              url: signedUrl.signedUrl,
            });
          }
        }

      } catch (itemError) {
        console.error(`Failure processing item loop context for ${item?.id}:`, itemError.message);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Wallet checkout halted: ${itemError.message}` }),
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        downloadLinks,
        amount: totalAmount,
        customer: buyerEmail,
      }),
    };

  } catch (err) {
    console.error("Wallet global server error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

