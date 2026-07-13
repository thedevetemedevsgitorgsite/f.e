const OWNER = "devlisting";
const REPO  = "devlisting.github.io";

const ALLOWED_ORIGINS = [
  "https://devtem.org"
];

function json(statusCode, body, headers = {}) {

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };

}

function escapeHtml(str = "") {

  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

}

function slugify(str = "") {

  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

}

function buildHtml(data) {
const seoDes = data.description.slice(0, 300);
  const bodyDes = data.description.replace(/\#([\w\-]+)/g, "<a href='https://devtem.org/home?q=$1' class='card-tag'>#$1</a>").replace(/\@([^\s\@]{3,})/g, "<span class='user-mention'>@$1</span>");

  return `<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${data.title} | DevTemple</title>

<meta name="title" content="${data.title} | DevTemple">
<meta name="description" content="${seoDes}">
<meta name="keywords" content="DevTemple, ${data.tags}, ${data.category}, digital assets, developer marketplace">
<meta name="author" content="${data.sellerName}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="language" content="English">
<meta name="theme-color" content="#0066ff">

<link rel="canonical" href="${data.listingUrl}">

<link
  rel="icon"
  type="image/png"
  href="https://devtem.org/assets/images/logo.png"
>

<link
  rel="apple-touch-icon"
  href="https://devtem.org/assets/images/logo.png"
>

<!-- Open Graph -->

<meta property="og:type" content="website">
<meta property="og:site_name" content="DevTemple">

<meta
  property="og:title"
  content="${data.title} | DevTemple"
>

<meta
  property="og:description"
  content="${seoDes}"
>

<meta
  property="og:url"
  content="${data.listingUrl}"
>

<meta
  property="og:image"
  content="${data.image}"
>

<meta
  property="og:image:secure_url"
  content="${data.image}"
>

<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<meta
  property="og:image:alt"
  content="${data.title}"
>

<meta property="og:locale" content="en_US">

<!-- Twitter -->

<meta
  name="twitter:card"
  content="summary_large_image"
>

<meta
  name="twitter:title"
  content="${data.title} | DevTemple"
>

<meta
  name="twitter:description"
  content="${seoDes}"
>

<meta
  name="twitter:image"
  content="${data.image}"
>

<meta
  name="twitter:image:alt"
  content="${data.title}"
>

<meta
  name="twitter:url"
  content="${data.listingUrl}"
>

<meta
  name="twitter:site"
  content="@fscss_ttr"
>

<meta
  name="twitter:creator"
  content="@fscss_ttr"
>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=ADLaM Display">
<!-- Schema.org JSON-LD -->

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication", 

  "name": ${JSON.stringify(data.title)},

  "image": ${JSON.stringify(data.image)},

  "description": ${JSON.stringify(seoDes)},

  "category": ${JSON.stringify(data.category)},

  "url": ${JSON.stringify(data.listingUrl)},

  "brand": {
    "@type": "Brand",
    "name": "DevTemple"
  },

  "seller": {
    "@type": "Person",
    "name": ${JSON.stringify(data.sellerName)},
    "url": ${JSON.stringify(data.authorLink || data.authorUrl)}
  },

  "offers": {

    "@type": "Offer",

    "url": ${JSON.stringify(data.productUrl)},

    "priceCurrency": "NGN",

    "price": ${JSON.stringify(data.rawPrice)},

    "availability": "https://schema.org/InStock",

    "itemCondition":
      "https://schema.org/NewCondition"

  },

  "publisher": {

    "@type": "Organization",

    "name": "DevTemple",

    "url": "https://devtem.org",

    "logo": {

      "@type": "ImageObject",

      "url":
        "https://devtem.org/assets/images/logo.png"

    }

  }, 
  "mainEntityOfPage": {
  "@type": "WebPage",
  "@id": "${data.listingUrl}"
}
}

</script>

<link
  rel="stylesheet"
  href="/assets/styles/listings-global.css"
>

<body>

<header>
  <a href="https://devtem.org">DevTemple</a>
</header>

<main>
<img
  src="${data.image}"
  alt="${data.title}"
  loading="lazy"
  decoding="async"
  class="product-img"
>

  <span class="badge">
    ${data.category}
  </span>

  <h1>${data.title}</h1>

  <p class="meta">
    By <b><a href="${data.authorLink||data.authorUrl}" title="Subscribe — ${data.sellerName}">${data.sellerName}</a></b>
  </p>

  <p class="price">
    ${data.price}
  </p>

  <p class="desc">
    ${bodyDes}
  </p>

  <a
    href="${data.productUrl}"
    class="cta"
  >
    View Product
  </a>

</main>
<footer class="footer">

  <div class="footer-grid">

    <div>

      <h3>
        DevTemple
      </h3>

      <p>
        
       <img
  src="https://devtem.org/assets/images/logo.png"
  alt="DevTemple Logo"
  class="footer-logo"
loading="lazy" decoding="async"> Marketplace for premium digital products,
        developer assets, tools, and creative resources.
      </p>

    </div>

    <div>

      <h3>
        Marketplace
      </h3>

      <a href="https://devtem.org/home">
        Browse Products
      </a>

      <a href="https://devtem.org/home?q=templates">
        Templates
      </a>

      <a href="https://devtem.org/home?q=script">
        Scripts
      </a>

      <a href="https://devtem.org/home?q=ui">
        UI Kits
      </a>

    </div>

    <div>

      <h3>
        Company
      </h3>

      <a href="https://devtem.org/about">
        About
      </a>

      <a href="https://devtem.org/contact">
        Contact
      </a>

      <a href="https://devtem.org/faq">
        FAQ
      </a>

    </div>

    <div>

      <h3>
        Legal
      </h3>

      <a href="https://devtem.org/terms">
        Terms
      </a>

      <a href="https://devtem.org/privacy">
        Privacy
      </a>

    </div>

  </div>

  <div class="footer-bottom">

    ©
    <span id="copyright-year">
      2026
    </span>

    <a rel="me" href="https://devtem.org">DevTemple</a>.
    All rights reserved.

  </div>

</footer>

<script>

document
  .getElementById("copyright-year")
  .textContent = new Date().getFullYear();

</script>

<script
  src="/assets/scripts/listings-global.js"
  type="module" defer></script>
</body>
</html>`;

}

exports.handler = async (event) => {

  const origin =
    event.headers.origin ||
    event.headers.Origin ||
    "";

  const corsHeaders = {

    "Access-Control-Allow-Origin":
      ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0],

    "Access-Control-Allow-Headers":
      "Content-Type, X-App-Upload-Token",

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {

    return json(
      403,
      {
        error: "Unauthorized origin",
      },
      corsHeaders
    );

  }

  if (event.httpMethod !== "POST") {

    return json(
      405,
      {
        error: "Method not allowed",
      },
      corsHeaders
    );

  }

  try {

    const appToken =
      event.headers["x-app-upload-token"];

    if (
      appToken !== process.env.APP_UPLOAD_SECRET
    ) {

      return json(
        401,
        {
          error: "Unauthorized",
        },
        corsHeaders
      );

    }

    const body =
      JSON.parse(event.body || "{}");

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
      seller_id, 
    } = body;

    if (!product_id || !title) {

      return json(
        400,
        {
          error:
            "product_id and title are required",
        },
        corsHeaders
      );

    }

    const safeTitle =
      escapeHtml(title).slice(0, 120);

    const safeDescription =
      escapeHtml(description || "")
        .slice(0, 1000);

    const safeCategory =
      escapeHtml(category || "Digital Product");

    const safeSeller =
      escapeHtml(seller_name || "DevTemple");

    const safeImage =
      image_url ||
      "https://devtem.org/assets/images/p.jpg";

    const safeTags = Array.isArray(tags)
      ? tags.map(escapeHtml).join(", ")
      : "";

    const formattedPrice =
      Number(price) > 0
        ? `₦${Number(price).toLocaleString()}`
        : "Free";

    const slug =
      `${product_id}-${slugify(title)}.html`;

    const listingUrl =
      `https://i.devtem.org/${product_id}-${slugify(title)}`;

    const productUrl =
      `https://devtem.org/p?id=${product_id}`;
    const html = buildHtml({

  title: safeTitle,

  description: safeDescription,

  image: safeImage,

  sellerName: safeSeller,

  category: safeCategory,

  tags: safeTags,

  listingUrl,

  productUrl,

  authorUrl:
    `https://devtem.org/home?q=${seller_username || ""}`,

  price: formattedPrice,

  rawPrice:
    Number(price) || 0,
  authorLink: `https://devtem.org/s?s=${seller_id}`, 
});

    const githubUrl =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${slug}`;

    const token =
      process.env.GITHUB_PAT;

    const encoded =
      Buffer.from(html)
        .toString("base64");

    const pushRes = await fetch(
      githubUrl,
      {

        method: "PUT",

        headers: {

          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/vnd.github+json",

          "Content-Type":
            "application/json",

          "User-Agent":
            "DevTemple-Publisher",

        },

        body: JSON.stringify({

          message:
            `listing: ${safeTitle}`,

          content: encoded,

        }),

      }
    );

    const pushData =
      await pushRes.json();

    if (!pushRes.ok) {

      return json(
        pushRes.status,
        {
          error:
            pushData.message ||
            "GitHub push failed",
        },
        corsHeaders
      );

    }

    return json(
      200,
      {
        success: true,
        url: listingUrl,
        slug,
      },
      corsHeaders
    );

  } catch (err) {

    console.error(err);

    return json(
      500,
      {
        error:
          err.message ||
          "Internal server error",
      },
      corsHeaders
    );

  }

};
