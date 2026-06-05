console.log("Hello from DevTemple")

const uMention document.querySelectorAll(".user-mention");
uMention.forEach(um => {
  // 1. Apply Styles
  um.style.cssText = `opacity:99%; text-decoration: 0.2px underline var(--glass-border); font-family: "ADLaM Display", monospace; cursor: pointer;`;

  // 2. Find the matching profile
  const mentionName = um.textContent.trim();
  um.onclick = ()=>{
    location.href = "https://devtem.org/s?s="+mentionName;
  }
});
