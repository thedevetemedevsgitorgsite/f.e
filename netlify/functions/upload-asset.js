// netlify/functions/upload-asset.js

export default async (request) => {
  // 1. Hardcode your exact trusted frontend origin domain here
  const ALLOWED_ORIGIN = "https://thedevetemedevsgitorgsite.github.io, http://localhost:7700"; 

  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN, 
    "Access-Control-Allow-Headers": "Content-Type, X-App-Upload-Token", // Accept custom security header
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

  // 2. SECURITY CHECK A: Verify the browser request origin matches your frontend domain
  const incomingOrigin = request.headers.get("origin");
  if (incomingOrigin !== ALLOWED_ORIGIN) {
    return new Response(JSON.stringify({ error: "Unauthorized Origin: Access Denied." }), { 
      status: 403, 
      headers: { "Content-Type": "application/json" } // No CORS headers returned for bad origins
    });
  }

  // 3. SECURITY CHECK B: Verify the custom handshake token
  const clientToken = request.headers.get("x-app-upload-token");
  const serverSecret = process.env.APP_UPLOAD_SECRET;

  if (!clientToken || clientToken !== serverSecret) {
    return new Response(JSON.stringify({ error: "Invalid or missing application token." }), { 
      status: 403, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const { fileName, fileData, userDir } = await request.json();
    
    if (!fileName || !fileData) {
      return new Response(JSON.stringify({ error: "Missing required file data." }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extract the raw base64 string out of the Data URL scheme
    const cleanBase64 = fileData.split(',')[1];

    const OWNER = "thedevetemedevsgitorgsite";
    const REPO = "thedevetemedevsgitorgsite.github.io"; 
    
    const safeFileName = fileName.replace(/\s+/g, '-');
    
    // Build deterministic paths using logic configurations
    const dir = (userDir ? userDir : 'unknown');
    const uid = crypto.randomUUID().slice(0, 8);
    const filePath = `u/${dir}/assets/images/${uid}-${safeFileName}`;

    const token = process.env.GITHUB_PAT; 
    if (!token) {
      return new Response(JSON.stringify({ error: "Server missing GitHub Auth Configuration Token." }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Call GitHub Content API via a PUT request to save/create the file
    const githubUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    
    const githubResponse = await fetch(githubUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "Netlify-Upload-Pipeline"
      },
      body: JSON.stringify({
        message: `media-upload: added asset ${safeFileName} via netlify engine`,
        content: cleanBase64 
      })
    });

    const githubResult = await githubResponse.json();

    if (!githubResponse.ok) {
      return new Response(JSON.stringify({ error: githubResult.message || "Failed pushing to Github repo." }), { 
        status: githubResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Public asset distribution mapping link
    const finalPublicUrl = `https://cdn.devtem.org/${filePath}`;

    return new Response(JSON.stringify({ 
      success: true, 
      url: finalPublicUrl,
      path: filePath 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

