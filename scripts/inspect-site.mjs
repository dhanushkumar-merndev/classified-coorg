import { chromium } from "@playwright/test";

const targetUrl = process.argv[2] || "https://landincoorg.vercel.app";
console.log("=== INSPECTING URL ===", targetUrl);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 412, height: 869 }, // Mobile viewport (matches Lighthouse mobile emulation)
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2.625,
});

const page = await context.newPage();
const client = await context.newCDPSession(page);

const issues = [];
await client.send("Audits.enable");
client.on("Audits.issueAdded", (issue) => {
  issues.push(issue);
});

await page.goto(targetUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

console.log("\n=== CHROME DEVTOOLS ISSUES ===");
console.log(JSON.stringify(issues, null, 2));

// Headings
const headings = await page.$$eval("h1, h2, h3, h4, h5, h6, [role='heading']", (elements) => {
  return elements.map((el) => {
    let level = 0;
    if (el.tagName.startsWith("H")) level = parseInt(el.tagName[1]);
    else if (el.getAttribute("aria-level")) level = parseInt(el.getAttribute("aria-level"));
    return {
      tag: el.tagName.toLowerCase(),
      level,
      text: el.innerText.trim().slice(0, 40),
    };
  });
});
console.log("\n=== HEADINGS ===");
for (let i = 0; i < headings.length; i++) {
  const h = headings[i];
  const prev = i > 0 ? headings[i - 1] : null;
  const skipped = prev && h.level > prev.level + 1;
  const outOfOrder = i === 0 && h.level !== 1;
  console.log(`[H${h.level}] "${h.text}" ${outOfOrder ? "<- FIRST HEADING NOT H1!" : ""} ${skipped ? `<- SKIPPED FROM H${prev.level}!` : ""}`);
}

// Touch targets evaluation exactly like Lighthouse
// Lighthouse flags any clickable element with bounding box < 48x48 if its center distance to any other touch target is < 48px, or overlapping touch targets.
const touchAudit = await page.evaluate(() => {
  const clickables = Array.from(document.querySelectorAll("a, button, input, select, textarea, [role='button'], [tabindex='0']"));
  const bad = [];
  for (const el of clickables) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
    if (rect.width === 0 || rect.height === 0) continue;
    
    // Lighthouse criteria: width < 48 or height < 48
    if (rect.width < 48 || rect.height < 48) {
      bad.push({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        className: el.className.slice(0, 50),
        text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim().slice(0, 35),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
  }
  return bad;
});
console.log(`\n=== TOUCH TARGETS UNDER 48px (${touchAudit.length} found) ===`);
console.log(touchAudit);

await browser.close();
