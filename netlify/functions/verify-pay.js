import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPA_URL,
  process.env.PUBLIC_SUPA_R_KEY
);

// Create transporter ONCE
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

  // Handle OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: "Method not allowed",
      }),
    };
  }

  try {
    // Verify SMTP once
    await transporter.verify();
    console.log("SMTP Ready");

    const body = JSON.parse(event.body || "{}");

    const { reference, rewId } = body;

    if (!reference) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing payment reference",
        }),
      };
    }

    // Verify Paystack payment
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SEC_KEY}`,
        },
      }
    );

    const paystackData = await paystackRes.json();

    console.log("Paystack response:", paystackData);

    if (
      !paystackData.status ||
      paystackData.data?.status !== "success"
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Payment verification failed",
        }),
      };
    }

    const payment = paystackData.data;
    const buyerCountry = payment.authorization?.country_code || null;

    // Fetch transaction
    const { data: transaction, error: txError } = await supabase
      .from("transactions_b")
      .select("*")
      .eq("reference", reference)
      .single();

    if (txError || !transaction) {
      console.error("Transaction fetch error:", txError);

      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: "Transaction not found",
        }),
      };
    }

    // Prevent duplicate processing
    if (transaction.status === "success") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "Already processed",
        }),
      };
    }

    // Update transaction
    await supabase
      .from("transactions_b")
      .update({
        status: "success",
      })
      .eq("reference", reference);

    const cart = transaction.cart_data || [];

    const buyerEmail =
      payment.customer?.email || "unknown@email.com";

    let downloadLinks = [];

    console.log("Processing cart:", cart);

    // Process all items
    for (const item of cart) {
      try {
        if (!item?.id) {
          console.log("Skipping invalid cart item");
          continue;
        }

        // Fetch post
        const { data: post, error: postError } = await supabase
          .from("posts")
          .select("sales, user_id, name")
          .eq("id", item.id)
          .single();

        if (postError || !post) {
          console.error(
            `Error fetching post ${item.id}:`,
            postError
          );
          continue;
        }

        const sellerId = post.user_id;

        if (!sellerId) {
          console.error(
            `No seller found for post ${item.id}`
          );
          continue;
        }

        console.log(
          `Processing item ${item.id} for seller ${sellerId}`
        );

        // Update sales
        const newSales = (post.sales || 0) + 1;

        const { error: updateSalesError } = await supabase
          .from("posts")
          .update({
            sales: newSales,
          })
          .eq("id", item.id);

        if (updateSalesError) {
          console.error(
            `Error updating sales for ${item.id}:`,
            updateSalesError
          );
        }

        // Reward system — records a commission row in `rew` for the referrer.
        // Skip if the referrer is the seller themself (no self-referral payouts).
        if (rewId && rewId !== sellerId) {
          const { data: refProfile, error: refProfileError } =
            await supabase
              .from("profiles")
              .select("id, status")
              .eq("id", rewId)
              .single();

          if (refProfileError || !refProfile) {
            console.error(
              `Referrer profile not found for rewId ${rewId}:`,
              refProfileError
            );
          } else {
            const itemPrice = Number(item.price || 0);
            const rewardAmount =
              refProfile.status === "verified"
                ? itemPrice * 0.1
                : itemPrice * 0.07;

            const { error: rewInsertError } = await supabase
              .from("rew")
              .insert({
                user_id: rewId,
                amount: rewardAmount,
                product_title: item.title || post.name || "Untitled Product",
              });

            if (rewInsertError) {
              console.error(
                "Reward insert error:",
                rewInsertError
              );
            } else {
              console.log(
                `Reward recorded for referrer ${rewId}: ₦${rewardAmount}`
              );
            }
          }
        }

        // Insert earnings
        const { error: earningsError } = await supabase
          .from("earnings")
          .insert({
            seller_id: sellerId,
            post_id: item.id,
            amount: Number(item.price || 0),
            buyer: buyerEmail,
          });

        if (earningsError) {
          console.error(
            `Earnings insert error:`,
            earningsError
          );
        } else {
          console.log(
            `Earnings inserted for ${item.id}`
          );
        }

        // Fetch seller profile
        const { data: sellerProfile } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", sellerId)
          .single();

        // Send seller email
        if (sellerProfile?.email) {
          try {
            await transporter.sendMail({
              from: `"DevTemple" <office@devtem.org>`,
              to: sellerProfile.email,
              subject: `🎉 You just made a sale on DevTemple!`,
              html: `
                <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
                  
                  <h2 style="color:#111">
                    You made a sale! 🎉
                  </h2>

                  <p>
                    Hi ${
                      sellerProfile.full_name || "there"
                    },
                  </p>

                  <p>
                    Your product 
                    <strong>
                      ${item.title || "Untitled Product"}
                    </strong> 
                    was purchased successfully.
                  </p>

                  <table style="width:100%;border-collapse:collapse;margin:1rem 0">

                    <tr>
                      <td style="padding:8px;color:#555">
                        Product
                      </td>

                      <td style="padding:8px">
                        <strong>
                          ${item.title || "Untitled Product"}
                        </strong>
                      </td>
                    </tr>

                    <tr style="background:#f9f9f9">
                      <td style="padding:8px;color:#555">
                        Amount
                      </td>

                      <td style="padding:8px">
                        <strong>
                          ₦${Number(
                            item.price || 0
                          ).toLocaleString()}
                        </strong>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:8px;color:#555">
                        Buyer
                      </td>

                      <td style="padding:8px">
                        ${maskEmail(buyerEmail)}
                      </td>
                    </tr>

                  </table>

                  <p>
                    <a href="https://devtem.org/dashboard">
                      View dashboard →
                    </a>
                  </p>

                  <hr style="border:none;border-top:1px solid #eee;margin:2rem 0">

                  <p style="color:#999;font-size:0.85rem">
                    DevTemple
                  </p>

                </div>
              `,
            });

            console.log(
              `Seller notification sent to ${sellerProfile.email}`
            );
          } catch (emailErr) {
            console.error(
              `Email send failed:`,
              emailErr
            );
          }
        }
        
        if (sellerProfile) {
          try {
            await transporter.sendMail({
              from: `"DevTemple" <office@devtem.org>`,
              to: "support@devtem.org",
              subject: `🎉 You just made a sale on DevTemple!`,
              html: `
                <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
                  
                  <h2 style="color:#111">
                    You made a sale! 🎉
                  </h2>

                  <p>
                    Hi Team,
                  </p>

                  <p>
                    ID: ${sellerProfile.id||"NULL"} NAME ${
                      sellerProfile.full_name || "there"
                    }'s product 
                    <strong>
                      ${item.title || "Untitled Product"} (id: ${item?.id})
                    </strong> 
                    was purchased successfully.
                  </p>

                  <table style="width:100%;border-collapse:collapse;margin:1rem 0">

                    <tr>
                      <td style="padding:8px;color:#555">
                        Product
                      </td>

                      <td style="padding:8px">
                        <strong>
                          ${item.title || "Untitled Product"}
                        </strong>
                      </td>
                    </tr>

                    <tr style="background:#f9f9f9">
                      <td style="padding:8px;color:#555">
                        Amount
                      </td>

                      <td style="padding:8px">
                        <strong>
                          ₦${Number(
                            item.price || 0
                          ).toLocaleString()}
                        </strong>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:8px;color:#555">
                        Buyer
                      </td>

                      <td style="padding:8px">
                        ${buyerEmail}
                      </td>
                    </tr>

                  </table>

                  <p>
                    <a href="https://devtem.org/dashboard">
                      View dashboard →
                    </a>
                  </p>

                  <hr style="border:none;border-top:1px solid #eee;margin:2rem 0">

                  <p style="color:#999;font-size:0.85rem">
                    DevTemple
                  </p>

                </div>
              `,
            });
            
            console.log(
              `Seller notification sent to Team`
            );
          } catch (emailErr) {
            console.error(
              `Team Email send failed:`,
              emailErr
            );
          }
        }
        
        // Generate download link
        if (item.filePath) {
          const {
            data: signedUrl,
            error: signedUrlError,
          } = await supabase.storage
            .from("uploads")
            .createSignedUrl(
              item.filePath,
              60 * 60 * 24
            );

          if (signedUrlError) {
            console.error(
              `Signed URL error:`,
              signedUrlError
            );
          } else if (signedUrl?.signedUrl) {
            downloadLinks.push({
              id: item.id,
              title: item.title || "Download",
              url: signedUrl.signedUrl,
            });
          }
        }
      } catch (itemError) {
        console.error(
          `Error processing item ${item?.id}:`,
          itemError
        );
      }
    }

    console.log(
      `Completed processing ${downloadLinks.length} downloads`
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        downloadLinks,
        reference: payment.reference,
        amount: payment.amount / 100,
        customer: buyerEmail,
      }),
    };
  } catch (err) {
    console.error("Verify-pay overall error:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
}
