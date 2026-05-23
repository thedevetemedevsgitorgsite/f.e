// Ensure 'exports' is lowercase
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { playerId, subscriberName } = body;

  if (!playerId || !subscriberName) {
    return { statusCode: 400, body: "Missing playerId or subscriberName" };
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Double-check that this environment variable is set in your host (e.g., Netlify/Vercel)
        "Authorization": `Basic ${process.env.ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        // FIX: Replaced deprecated 'include_player_ids' with the modern alias array
        include_aliases: {
          onesignal_id: [playerId]
        },
        target_channel: "push", // Explicitly target push notifications
        headings: { en: "New Subscriber 🎉" },
        contents: { en: `${subscriberName} just subscribed to you on DevTemple!` },
        url: "https://devtem.org/dashboard",
      }),
    });

    const data = await response.json();

    // Check if OneSignal returned an API-level error (e.g., bad auth or invalid ID)
    if (!response.ok) {
      console.error("OneSignal API Error:", data);
      return { 
        statusCode: response.status, 
        body: JSON.stringify({ error: "OneSignal rejected the request", details: data }) 
      };
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({ message: "Notification sent successfully", data }) 
    };

  } catch (err) {
    console.error("Network or Runtime error:", err);
    return { statusCode: 500, body: "Notification failed due to an internal server error" };
  }
};

