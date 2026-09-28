import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  await page.goto(base);
  await page.getByRole("button", { name: /เข้า Demo ผู้สอน/ }).click();
  await page.goto(`${base}/demo/instructor/report/class-feasible-assignment`);
  await page.getByRole("heading", { name: "รายงานผู้สอน" }).waitFor();
  assert.ok(await page.getByText("คะแนนตั้งต้นของกลุ่ม").count());
  assert.ok(await page.getByText("จำนวนคำตอบต่อคู่").count());
  const downloadPromise = page.waitForEvent("download");
  await page.goto(`${base}/demo/instructor/export/class-feasible-assignment`);
  await page.getByRole("link", { name: "ดาวน์โหลด CSV" }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /paireval-.*-scores\.csv/);
  await page.getByRole("link", { name: "เปลี่ยนบทบาท" }).click();
  await page.getByRole("button", { name: /เข้า Demo นักศึกษา/ }).click();
  await page.goto(`${base}/demo/student/score/class-feasible-assignment`);
  await page.getByRole("heading", { name: "คะแนนของฉัน" }).waitFor();
  assert.ok(await page.getByText("สถานะการส่งของฉัน").count());
  assert.equal(await page.getByText("นักศึกษาตัวอย่าง 02").count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("heading", { name: "คะแนนของฉัน" }).waitFor();
  console.log("Day 5 browser: report, CSV download, private My Score, mobile view passed (4/4).");
} finally { await browser.close(); }
