
const uMention = document.querySelectorAll(".user-mention");
uMention.forEach(um => {
  // 1. Apply Styles
  um.style.cssText = `opacity:99%; text-decoration: 0.2px underline var(--glass-border); font-family: "ADLaM Display", monospace; cursor: pointer;`;
  
  // 2. Find the matching profile
  const mentionName = um.textContent.trim();
  um.onclick = () => {
    location.href = "https://devtem.org/s?s=" + mentionName;
  }
});

const main = document.querySelector("main");
const becomeCard = document.createElement("div");
becomeCard.className = "promo-card";
becomeCard.innerHTML = `
    <div class="flex-between">
      <div>
        <h3 style="font-size: 1.5rem; font-weight: 700;">Become a Creator</h3>
        <p style="max-width: 550px; margin: 0.5rem 0;">Monetize your expertise — sell digital assets, code snippets, or design resources. Join a thriving community and earn up to 85% royalties.</p>
        <div style="margin-top: 1rem;">
          <a href="https://devtem.org/signup" class="btn-primary" style="background: #1f2b48;">Start Selling</a>
        </div>
      </div>
      <div>
        <span class="badge" style="background: #0066ff10; font-size: 0.9rem; margin-right: 8px;">10% referral commission</span>
        <span class="badge" style="background: #0066ff10; font-size: 0.9rem;">2000+ Digital products</span>
      </div>
    </div>
`;
main.appendChild(becomeCard);
