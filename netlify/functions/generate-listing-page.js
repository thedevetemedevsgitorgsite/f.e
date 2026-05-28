export default async (request) => {
  const ALLOWED_ORIGINS = [
    "https://thedevetemedevsgitorgsite.github.io",
    "https://devtem.org",
    "http://localhost:7700",
    "https://localhost:7700"
  ];

  const incomingOrigin = request.headers.get("origin");
  const isAllowed = ALLOWED_ORIGINS.includes(incomingOrigin);

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed ? incomingOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "Content-Type, X-App-Upload-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!isAllowed) {
    return new Response(JSON.stringify({ error: "Unauthorized Origin" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const {
      product_id,
      title,
      description,
      price,
      tags,
      image_url,
      seller_username,
      seller_name,
      category,
    } = await request.json();

    if (!product_id || !title) {
      return new Response(JSON.stringify({ error: "product_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Build slug: "my-cool-product-id-abc123.html"
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-id-${product_id}.html`;

    // Updated paths matching your routing instructions
    const productUrl = `https://devtem.org/p?id=${product_id}`;
    const authorUrl = `https://devtem.org/home?q=${seller_username || ""}`;
    const listingUrl = `https://i.devtem.org/${slug}`;
    
    const safeImage = image_url || "https://devtem.org/assets/images/p.jpg";
    const safeDesc = (description || "").slice(0, 160);
    const safeTags = Array.isArray(tags) ? tags.join(", ") : (tags || "");
    const safePrice = price ? `₦${Number(price).toLocaleString()}` : "Free";
    const safeCategory = category || "Digital Product";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${title} | DevTemple</title>
  <meta name="title" content="${title} | DevTemple">
  <meta name="description" content="${safeDesc}">
  <meta name="keywords" content="DevTemple, ${safeTags}, digital assets, ${safeCategory}, developer marketplace, devtem.org">
  <meta name="author" content="${seller_name || "DevTemple"}">
  <meta name="application-name" content="DevTemple">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="language" content="English">
  <meta name="theme-color" content="#0066ff">

  <link rel="canonical" href="${listingUrl}">

  <link rel="icon" type="image/png" href="https://devtem.org/assets/images/logo.png">
  <link rel="apple-touch-icon" href="https://devtem.org/assets/images/logo.png">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="DevTemple">
  <meta property="og:title" content="${title} | DevTemple">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:url" content="${listingUrl}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:secure_url" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="${title}">
  <meta property="og:locale" content="en_US">
  <meta property="product:price:amount" content="${price || 0}">
  <meta property="product:price:currency" content="NGN">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title} | DevTemple">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImage}">
  <meta name="twitter:image:alt" content="${title}">
  <meta name="twitter:site" content="@fscss_ttr">
  <meta name="twitter:creator" content="@fscss_ttr">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "${title}",
    "image": "${safeImage}",
    "description": "${safeDesc}",
    "url": "${listingUrl}",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "NGN",
      "price": "${price || 0}",
      "availability": "https://schema.org/InStock",
      "url": "${productUrl}"
    },
    "brand": {
      "@type": "Brand",
      "name": "DevTemple"
    },
    "seller": {
      "@type": "Person",
      "name": "${seller_name || "DevTemple"}",
      "url": "${authorUrl}"
    },
    "category": "${safeCategory}",
    "publisher": {
      "@type": "Organization",
      "name": "DevTemple",
      "url": "https://devtem.org",
      "logo": {
        "@type": "ImageObject",
        "url": "https://devtem.org/assets/images/logo.png"
      }
    }
  }
  </script>

  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/listings-global.css">
</head>
<body>

  <header>
    <a href="https://devtem.org">DevTemple</a>
    <a href="${productUrl}" class="header-action-link">View on DevTemple →</a>
  </header>

  <main>
    <img class="product-img" src="${safeImage}" alt="${title}" onerror="this.src='https://devtem.org/assets/images/p.jpg'">
    <span class="badge">${safeCategory}</span>
    <h1>${title}</h1>
    <p class="meta">By <strong>${seller_name || "DevTemple"}</strong>${seller_username ? ` &middot; @${seller_username}` : ""}</p>
    <p class="price">${safePrice}</p>
    <p class="desc">${description || ""}</p>
    ${safeTags ? `<div class="tags">${safeTags.split(",").map(t => `<span class="tag">${t.trim()}</span>`).join("")}</div>` : ""}
    <a class="cta" href="${productUrl}">Get This Product →</a>
    ${seller_username ? `
    <div class="seller">
      <strong>${seller_name || seller_username}</strong><br>
      <a href="${authorUrl}">View all products by @${seller_username} on DevTemple</a>
    </div>` : ""}
  </main>

  <footer>
    <p>&copy; <span id="copyright-year">2026</span> DevTemple · <a href="https://devtem.org/terms">Terms</a> · <a href="https://devtem.org/terms/privacy">Privacy</a> · <a href="https://devtem.org">devtem.org</a></p>
  </footer>

  <script>
    document.getElementById("copyright-year").textContent = new Date().getFullYear();
  </script>
  <script src="/assets/js/listings-global.js" async></script>
</body>
</html>`;

    // Push to devlisting.github.io via GitHub API
    const OWNER = "devlisting";
    const REPO = "devlisting.github.io";
    const token = process.env.GITHUB_PAT;

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing GITHUB_PAT" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const encoded = btoa(unescape(encodeURIComponent(html)));
    const githubUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${slug}`;

    let sha = undefined;
    const checkRes = await fetch(githubUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "Netlify-Listing-Pipeline"
      }
    });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }

    const pushRes = await fetch(githubUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "Netlify-Listing-Pipeline"
      },
      body: JSON.stringify({
        message: `listing: ${title} (${product_id})`,
        content: encoded,
        ...(sha ? { sha } : {})
      })
    });

    const pushResult = await pushRes.json();

    if (!pushRes.ok) {
      return new Response(JSON.stringify({ error: pushResult.message || "GitHub push failed" }), {
        status: pushRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      slug,
      url: listingUrl
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
