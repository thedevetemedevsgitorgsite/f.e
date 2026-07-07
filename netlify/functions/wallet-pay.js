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
    let processedAny = false; 

    // 2. Route transactional payments safely
    for (const item of cart) {
      try {
        const itemId = item.id;
        
        if (!itemId) {
          console.error("Skipping item: completely missing an item ID");
          continue;
        }

        // FETCH the missing master data from the database so we don't trust local storage
        const { data: post, error: postError } = await supabase
          .from("posts")
          .select("sales, name, filePath, user_id, price")
          .eq("id", itemId)
          .single();

        if (postError || !post) {
          console.error(`Skipping item ${itemId}: Not found in posts table`, postError);
          continue;
        }

        // Authoritative data matching: prioritize database over client-side cart values
        const sellerId = post.user_id; 
        const itemPrice = Number(item.price || post.price);
        const itemTitle = item.title || post.name || "Untitled Product";
        const targetPath = post.filePath;

        if (!sellerId || isNaN(itemPrice) || itemPrice <= 0) {
          console.error(`Skipping item ${itemId}: Invalid price or missing seller_id inside DB configuration`);
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

        processedAny = true; 

        // Update product statistics
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
              product_title: itemTitle,
              source: null,
              country: null
            });
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

    // Guard checking if everything in the loop got skipped
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

