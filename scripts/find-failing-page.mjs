import { execSync } from "child_process";

const pages = [
  "/",
  "/properties",
  "/locations",
  "/locations/madikeri",
  "/property-types",
  "/guides",
  "/guides/understanding-jamma-bane-land-coorg",
  "/verification",
  "/disclaimer",
  "/login",
  "/property/23-acre-well-maintained-robusta-estate-with-processing-units-block-2-97"
];

for (const p of pages) {
  try {
    const url = `https://landincoorg.vercel.app${p}`;
    const out = execSync(
      `CHROME_PATH=/home/dhanush/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome pnpx lighthouse ${url} --only-audits=target-size,heading-order,inspector-issues --chrome-flags="--headless --no-sandbox" --output=json`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"], timeout: 30000 }
    );
    const data = JSON.parse(out);
    const ts = data.audits["target-size"];
    const ho = data.audits["heading-order"];
    const ii = data.audits["inspector-issues"];
    console.log(`\n=== PAGE: ${p} ===`);
    if (ts.score !== 1) console.log("  [FAIL] target-size:", ts.details?.items);
    if (ho.score !== 1) console.log("  [FAIL] heading-order:", ho.details?.items?.map(i => i.node?.snippet));
    if (ii.score !== 1) console.log("  [FAIL] inspector-issues:", ii.details?.items);
    if (ts.score === 1 && ho.score === 1 && ii.score === 1) console.log("  ALL PASSED");
  } catch (err) {
    console.log(`Error auditing ${p}:`, err.message);
  }
}
