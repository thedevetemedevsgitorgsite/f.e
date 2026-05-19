// netlify/functions/upload-asset.js

export default async (request) => {
  // Define your array of trusted domains
  const ALLOWED_ORIGINS = [
    "https://thedevetemedevsgitorgsite.github.io",
    "https://devtem.org",
    "http://localhost:7700",  // Add your local dev servers here
    "https://localhost:7700"
  ];

  const incomingOrigin = request.headers.get("origin");
  
  // Check if the incoming request origin is in your trusted list
  const isAllowed = ALLOWED_ORIGINS.includes(incomingOrigin);
  
  // Dynamically reflect the allowed origin back to pass browser CORS mechanics
  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed ? incomingOrigin : ALLOWED_ORIGINS[0], 
    "Access-Control-Allow-Headers": "Content-Type, X-App-Upload-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle Browser Pre-flight Options Check
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Enforce POST method
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // SECURITY CHECK A: Drop request instantly if the origin isn't verified
  if (!isAllowed) {
    return new Response(JSON.stringify({ error: "Unauthorized Origin: Access Denied." }), { 
      status: 403, 
      headers: { "Content-Type": "application/json" }
    });
  }

  // ... rest of your code remains exactly the same

