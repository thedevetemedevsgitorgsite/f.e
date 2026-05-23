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
        "Authorization": `Basic ${process.env.ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: [playerId],
        headings: { en: "New Subscriber 🎉" },
        contents: { en: `${subscriberName} just subscribed to you on DevTemple!` },
        url: "https://devtem.org/dashboard",
      }),
    });

    const data = await response.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    console.error("OneSignal error:", err);
    return { statusCode: 500, body: "Notification failed" };
  }
};
