import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const state = JSON.parse(
    await readFile(
      ".verification/v20-20261015/presentation-state.json",
      "utf8",
    ),
  ),
  origin = "http://localhost:3101",
  portal = "http://localhost:3103",
  dir = ".verification/v20-20261015";
const browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  }),
  page = await context.newPage(),
  results = [];
await context.route("**/*", (r) =>
  ["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname)
    ? r.continue()
    : r.abort(),
);
async function enter(name) {
  await page.goto(portal);
  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button")
    .click();
  await page.waitForURL(origin + "/full-system", {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "เลือกห้องเรียน", exact: true })
    .waitFor();
}
async function scan(name) {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  results.push({ page: name, violations: scan.violations });
  await page.screenshot({
    path: dir + "/presentation-" + name + ".png",
    fullPage: true,
  });
}
try {
  await page.goto(portal);
  await page.getByRole("heading", { name: "PairEval พร้อมสาธิต" }).waitFor();
  await scan("portal");
  await enter("อาจารย์เจ้าของห้อง");
  await scan("owner-dashboard");
  await page
    .getByRole("link", { name: "จัดการห้องเรียน", exact: false })
    .first()
    .click();
  await page
    .getByRole("button")
    .filter({ hasText: "ประเมินผลงานโครงงาน" })
    .click();
  await scan("assignment");
  await page
    .getByRole("link", { name: "ดูรายงานและตัดสินคะแนน", exact: false })
    .click();
  await page
    .getByRole("button", { name: "ดาวน์โหลด CSV", exact: true })
    .waitFor();
  await scan("report");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ดาวน์โหลด CSV", exact: true })
    .click();
  assert.ok((await download).suggestedFilename().endsWith(".csv"));
  await enter("นักศึกษาคนที่ 1");
  await page.goto(
    `${origin}/full-system/assignments/${state.assignment}/evaluate/group`,
  );
  await page.getByRole("radio").first().waitFor();
  await scan("student");
  const popup = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: "เปิดผลงาน", exact: false })
    .first()
    .click();
  const artifact = await popup;
  await artifact.waitForLoadState();
  assert.ok((await artifact.locator("h1").textContent()).includes("กลุ่ม"));
  await artifact.close();
  await page.goto(
    `${origin}/full-system/assignments/${state.assignment}/my-score`,
  );
  await page.getByRole("heading", { name: "คะแนนของฉัน" }).waitFor();
  await scan("my-score");
  await enter("ผู้ช่วยสอน");
  await page.goto(`${origin}/full-system/classrooms/${state.room}/roster`);
  await page.getByRole("heading").first().waitFor();
  await scan("ta-roster");
  await page.goto(portal);
  console.log(
    "Presentation role switches, instructor navigation, CSV download and local artifact opening passed with all external requests blocked",
  );
  console.log(
    JSON.stringify(
      results.map((r) => ({
        page: r.page,
        violations: r.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
      })),
      null,
      2,
    ),
  );
  await writeFile(
    dir + "/presentation-check.json",
    JSON.stringify(results, null, 2),
  );
  if (results.some((r) => r.violations.length)) process.exitCode = 1;
} finally {
  await browser.close();
}
