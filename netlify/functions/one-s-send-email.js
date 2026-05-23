// netlify/functions/one-s-send-email.js

import * as OneSignal from "@onesignal/node-onesignal";

export async function handler(event, context) {
  try {
    const configuration = OneSignal.createConfiguration({
      restApiKey: process.env.ONESIGNAL_API_KEY,
    });

    const client = new OneSignal.DefaultApi(configuration);

    const notification = {
      app_id: process.env.ONESIGNAL_APP_ID,

      include_email_tokens: ["davidhux22@gmail.com"],

      email_subject: "Welcome to OneSignal Email",

      email_preheader: "We're happy to have you on board!",

      email_body: `
        <body style="font-family:'Helvetica Neue';font-size:16px;color:#424d57;line-height:1.8;max-width:600px">
          <h2>You just sent your first OneSignal email!</h2>

          <p>
            Testing OneSignal email integration from Netlify Functions.
          </p>

          <p>
            <a href="https://onesignal.com">
              Visit OneSignal
            </a>
          </p>
        </body>
      `
    };

    const response = await client.createNotification(notification);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        response
      }),
    };

  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err.message
      }),
    };
  }
      }
