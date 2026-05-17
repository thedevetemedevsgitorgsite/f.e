// netlify/functions/upload-asset.js

export default async (request) => {
  // Enforce POST method
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { fileName, fileData } = await request.json();
    
    if (!fileName || !fileData) {
      return new Response(JSON.stringify({ error: "Missing required file data." }), { status: 400 });
    }

    // Extract the raw base64 string out of the Data URL scheme
    // e.g., Removes "data:image/png;base64," leaving only the cryptographic text
    const cleanBase64 = fileData.split(',')[1];

    // Your target configuration based on your URL destination
    const OWNER = "thedevetemedevsgitorgsite";
    const REPO = "thedevetemedevsgitorgsite.github.io"; 
    
    // Ensure file names don't crash by replacing spaces if any
    const safeFileName = fileName.replace(/\s+/g, '-');
    
    // Target location inside your repo structure: u/assets/images/id...
    const filePath = `u/assets/images/${Date.now()}-${safeFileName}`;

    // GitHub API requires token authentication via environment variables
    const token = process.env.GITHUB_PAT; 

    if (!token) {
      return new Response(JSON.stringify({ error: "Server missing GitHub Auth Configuration Token." }), { status: 500 });
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
        content: cleanBase64 // GitHub demands pure base64 text strings
      })
    });

    const githubResult = await githubResponse.json();

    if (!githubResponse.ok) {
      return new Response(JSON.stringify({ error: githubResult.message || "Failed pushing to Github repo." }), { status: githubResponse.status });
    }

    // Construct your clean, predictable target deployment URL string
    const finalPublicUrl = `https://${OWNER}.github.io/${filePath}`;

    return new Response(JSON.stringify({ 
      success: true, 
      url: finalPublicUrl,
      path: filePath 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
