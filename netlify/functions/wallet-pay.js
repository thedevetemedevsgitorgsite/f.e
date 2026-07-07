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

// ... (Keep your top-level setup, transporter, and maskEmail function identical)

export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    await transporter.verify();
    const body = JSON.parse(event.body || "{}");
    const { userId, walletSource, totalAmount, rewId, cart } = body;

    if (!userId || !walletSource || !totalAmount || !cart || cart.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required checkout parameters" }) };
    }

    const { data: buyerProfile, error: buyerError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (buyerError || !buyerProfile) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Buyer profile record not found" }) };
    }

    const buyerEmail = buyerProfile.email;
    let downloadLinks = [];

    // Track if at least one item was successfully handled
    let processedAny = false; 

    for (const item of cart) {
      try {
        // Fallback checks to accommodate both camelCase and snake_case properties seamlessly
        const itemId = item.id;
        const sellerId = item.sellerId || item.seller_id;
        const itemPrice = Number(item.price);
        const itemTitle = item.title || "Untitled Product";
        const itemFilePath = item.filePath || item.file_path;

        if (!itemId || !sellerId || isNaN(itemPrice) || itemPrice <= 0) {
          console.error("Skipping item due to missing identification structural attributes:", item);
          continue;
        }

        // Execute the database wallet transaction function 
        const { data: rpcData, error: rpcError } = await supabase.rpc("wallet_transfer", {
          p_sender_id: userId,
          p_recipient_id: sellerId,
          p_amount: itemPrice,
          p_wallet_source: walletSource,
          p_note: `Purchase: ${itemTitle}`
        });

        if (rpcError || !rpcData?.success) {
          console.error("RPC Ledger Transaction Refused:", rpcError, rpcData);
          throw new Error(rpcData?.error || rpcError?.message || "Internal transaction processing error.");
        }

        processedAny = true; // Mark that a transfer actually executed successfully

        // Update product statistics
        const { data: post, error: postError } = await supabase
          .from("posts")
          .select("sales, name, filePath")
          .eq("id", itemId)
          .single();

        if (!postError && post) {
          const newSales = (post.sales || 0) + 1;
          await supabase.from("posts").update({ sales: newSales }).eq("id", itemId);

          // Calculate Referral Commissions
          if (rewId && rewId !== sellerId) {
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
                product_title: itemTitle || post.name,
                source: null,
                country: null
              });
            }
          }
        }

        // Notify Creator
        const { data: sellerProfile } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", sellerId)
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
                  <p>Your product <strong>${itemTitle}</strong> was purchased using a wallet balance.</p>
                  <table style="width:100%;border-collapse:collapse;margin:1rem 0">
                    <tr><td style="padding:8px;color:#555">Product</td><td style="padding:8px"><strong>${itemTitle}</strong></td></tr>
                    <tr style="background:#f9f9f9"><td style="padding:8px;color:#555">Amount</td><td style="padding:8px"><strong>₦${itemPrice.toLocaleString()}</strong></td></tr>
                    <tr><td style="padding:8px;color:#555">Buyer</td><td style="padding:8px">${maskEmail(buyerEmail)}</td></tr>
                  </table>
                  <p><a href="https://devtem.org/dashboard">View dashboard →</a></p>
                </div>
              `,
            });
          } catch (mErr) { console.error("Mail error ignored:", mErr); }
        }

        // Generate Time-sensitive Storage Signed Links
        const targetPath = itemFilePath || post?.filePath;
        if (targetPath) {
          const { data: signedUrl, error: signedUrlError } = await supabase.storage
            .from("uploads")
            .createSignedUrl(targetPath, 60 * 60 * 24);

          if (!signedUrlError && signedUrl?.signedUrl) {
            downloadLinks.push({
              id: itemId,
              title: itemTitle,
              url: signedUrl.signedUrl,
            });
          }
        }

      } catch (itemError) {
        console.error(`Item transactional loop step error:`, itemError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Wallet process failed: ${itemError.message}` }),
        };
      }
    }

    // Fail early if nothing was processed
    if (!processedAny) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No items in your cart could be processed. Verify item data schema parameters." }),
      };
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
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}

