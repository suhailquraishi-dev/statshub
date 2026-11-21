// Visual QA: screenshots every page at 375/768/1024/1440 in light and dark,
// flags horizontal overflow, clipped text and tap targets under 44px, then
// runs the core participation flow end to end.
// Usage: BASE=http://localhost:3100 node scripts/visual-qa.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require(require.resolve("playwright", { paths: [process.env.NODE_PATH ?? "", "/usr/lib/node_modules", "/usr/local/lib/node_modules"] }))); }
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "qa-shots";
mkdirSync(OUT, { recursive: true });
const WIDTHS = [375, 768, 1024, 1440];
const ALL_PAGES = [
  ["home", "/fanpulse"],
  ["matchup", "/fanpulse/nfl/matchups/2026-w12-hcm-rvh"],
  ["matchup-final", "/fanpulse/nfl/matchups/2026-w11-rvh-mfb"],
  ["discussion", "/fanpulse/nfl/discussions/d103-can-the-pioneers-defense-slow-down-the-bison"],
];
const PAGES = process.env.ONLY ? ALL_PAGES.filter(([n]) => process.env.ONLY.split(",").includes(n)) : ALL_PAGES;
// Animations are disabled through prefers-reduced-motion (the app honours it), not by injecting styles mid-hydration.

async function audit(page) {
  return page.evaluate(() => {
    const issues = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1) issues.push(`horizontal overflow: ${doc.scrollWidth} > ${doc.clientWidth}`);
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || el.closest(".sr-only, dialog:not([open]), .skip-link")) continue;
      if (r.right > doc.clientWidth + 1 && !el.closest(".fp-table-wrap, .fp-tabs")) issues.push(`off-screen right: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(r.right)}px`);
      const interactive = el.matches("button, a.fp-btn, select, input:not([type=radio]):not([type=checkbox]), textarea, [role=tab], [role=radio]");
      if (interactive && (r.height < 44 || (r.width < 44 && !el.matches("a:not(.fp-btn)")))) issues.push(`small target ${Math.round(r.width)}x${Math.round(r.height)}: ${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`);
      if ((cs.overflow === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0 && el.textContent.trim()) issues.push(`clipped text: "${el.textContent.trim().slice(0, 40)}"`);
    }
    return [...new Set(issues)].slice(0, 15);
  });
}

// QA_CHROME: optional path to an installed Chrome, when Playwright's own browser is not downloaded.
const browser = await chromium.launch(process.env.QA_CHROME ? { executablePath: process.env.QA_CHROME } : {});
let problems = 0;
// Light mode only: the site has no dark theme.
for (const theme of ["light"]) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    let docHtml = "";
    page.on("response", async (r) => { if (r.request().resourceType() === "document") docHtml = await r.text().catch(() => ""); });
    for (const [name, path] of PAGES) {
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      if (process.env.DUMP && errors.some((e) => e.includes("418"))) {
        const { writeFileSync } = await import("node:fs");
        writeFileSync(`${OUT}/dump-server-${name}-${w}-${theme}.html`, docHtml);
        writeFileSync(`${OUT}/dump-client-${name}-${w}-${theme}.html`, await page.evaluate(() => document.documentElement.outerHTML));
      }
      const issues = await audit(page);
      if (errors.length) issues.push(...errors.splice(0).map((e) => `console: ${e.slice(0, 120)}`));
      if (issues.length) { problems += issues.length; console.log(`✗ ${name} ${w} ${theme}\n   ${issues.join("\n   ")}`); }
      else console.log(`✓ ${name} ${w} ${theme}`);
      if (theme === "light" || w === 375 || w === 1440) await page.screenshot({ path: `${OUT}/${name}-${w}-${theme}.png`, fullPage: true });
    }
    await ctx.close();
  }
}

if (process.env.ONLY) { await browser.close(); console.log(problems + " issues"); process.exit(0); }
// End-to-end flow at phone width (keyboard and touch sized)
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await ctx.newPage();
const step = (s) => console.log(`  → ${s}`);
const flowErrors = [];
page.on("pageerror", (e) => flowErrors.push(e.message));
try {
  await page.goto(BASE + "/fanpulse/nfl/matchups/2026-w12-hcm-rvh", { waitUntil: "networkidle" });
  step("switch period to Last 5 games");
  const before = await page.locator(".fp-insights").first().innerText();
  await page.getByRole("radio", { name: "Last 5 games" }).first().click();
  const after = await page.locator(".fp-insights").first().innerText();
  if (before === after || !after.startsWith("Over their last 5")) throw new Error("explanation did not update with the period");
  step("vote while signed out opens sign-in");
  await page.locator(".fp-poll__opt").first().click();
  await page.getByRole("button", { name: "Vote", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: `${OUT}/flow-signin-390.png` });
  await page.getByLabel("Email").fill("pat@example.com");
  await page.getByLabel("Display name").fill("Pat from Ohio");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Thanks, your vote is counted.").waitFor();
  step("vote counted once");
  await page.getByText("1 vote · one per account").first().waitFor();
  step("comment with stat evidence");
  await page.getByLabel(/Your take/).fill("The Mariners have scored more lately, and it shows on third down.");
  await page.getByRole("button", { name: "Add a stat" }).click();
  await page.getByRole("button", { name: "Preview stat" }).click();
  await page.getByText("Preview · Stat evidence").waitFor();
  await page.getByRole("button", { name: "Attach to my comment" }).click();
  await page.getByRole("button", { name: "Post comment" }).click();
  await page.locator(".fp-comment").first().waitFor();
  await page.locator(".fp-comment .fp-evidence").first().waitFor();
  await page.screenshot({ path: `${OUT}/flow-comment-390.png`, fullPage: true });
  step("incompatible evidence is refused");
  await page.getByRole("button", { name: "No thanks" }).click().catch(() => {});
  await page.getByRole("button", { name: "Add a stat" }).click();
  await page.getByRole("button", { name: "Players" }).click();
  await page.getByLabel("Stat", { exact: true }).selectOption("pass_yds_pg");
  await page.getByLabel("Player", { exact: true }).selectOption("p-hcm-wr");
  await page.getByRole("button", { name: "Preview stat" }).click();
  await page.getByText(/can't be compared/).waitFor();
  await page.getByRole("button", { name: "Cancel" }).last().click();

  step("second fan reports the comment");
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + "/fanpulse/nfl/matchups/2026-w12-hcm-rvh", { waitUntil: "networkidle" });
  await p2.getByRole("button", { name: "Sign in", exact: true }).click();
  await p2.getByLabel("Email").fill("lee@example.com");
  await p2.getByLabel("Display name").fill("Lee");
  await p2.getByRole("button", { name: "Continue" }).click();
  await p2.waitForLoadState("networkidle");
  await p2.locator(".fp-comment").first().getByRole("button", { name: "Report" }).click();
  await p2.getByRole("button", { name: "Off topic" }).click();
  await p2.getByText("Reported. A moderator will review it.").waitFor();

  step("editor reviews the queue, approves a signal draft");
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + "/fanpulse", { waitUntil: "networkidle" });
  await p3.getByRole("button", { name: "Sign in", exact: true }).click();
  await p3.getByLabel("Email").fill("qa.editor@essentiallysports.com");
  await p3.getByLabel("Display name").fill("QA Editor");
  await p3.getByRole("button", { name: "Continue" }).click();
  await p3.getByRole("link", { name: "Editor tools" }).click();
  await p3.waitForURL("**/editor");
  await p3.getByText("Reports: Off topic").waitFor();
  await p3.getByRole("button", { name: "Keep" }).click();
  await p3.getByText("Nothing to review.").waitFor();
  await p3.getByRole("button", { name: "Create draft" }).first().click();
  await p3.getByRole("button", { name: "Approve and publish" }).first().waitFor();
  await p3.screenshot({ path: `${OUT}/editor-1440-light.png`, fullPage: true });
  const edIssues = await audit(p3);
  if (edIssues.length) { problems += edIssues.length; console.log(`✗ editor 1440\n   ${edIssues.join("\n   ")}`); }
  await p3.setViewportSize({ width: 375, height: 900 });
  const edPhone = await audit(p3);
  if (edPhone.length) { problems += edPhone.length; console.log(`✗ editor 375\n   ${edPhone.join("\n   ")}`); }
  await p3.screenshot({ path: `${OUT}/editor-375-light.png`, fullPage: true });
  await p3.getByRole("button", { name: "Approve and publish" }).first().click();
  await p3.waitForLoadState("networkidle");
  console.log("✓ end-to-end flow");
} catch (e) {
  problems++;
  console.log(`✗ flow failed: ${e.message}`);
  await page.screenshot({ path: `${OUT}/flow-failure.png`, fullPage: true });
}
if (flowErrors.length) { problems += flowErrors.length; console.log("✗ page errors:", flowErrors); }
await browser.close();
console.log(problems ? `\n${problems} issue(s) found` : "\nNo issues found");
process.exit(problems ? 1 : 0);
