import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base);
  await page.getByRole("button", { name: /เข้า Demo ผู้สอน/ }).click();
  await page.goto(`${base}/demo/instructor/pairing/class-infeasible-assignment`);
  await page.getByText("จัดคู่ไม่ได้", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "บันทึกคู่ทั้งหมดของงาน" }).count(), 0);
  assert.ok((await page.getByText(/มีผู้ประเมินที่มีสิทธิ์ 0 คน ต้องการ 5 คน/).count()) > 0);
  await page.goto(`${base}/demo/instructor/pairing/class-feasible-assignment`);
  await page.getByText("พร้อมสร้างคู่", { exact: true }).waitFor();
  assert.ok((await page.getByText("345", { exact: true }).count()) > 0);
  await page.getByRole("button", { name: "บันทึกคู่ทั้งหมดของงาน" }).click();
  await page.getByText("สร้างคู่ครบแล้ว", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("สร้างคู่ครบแล้ว", { exact: true }).waitFor();
  const actual = await page.locator(".pairing-stats>div").last().innerText();
  assert.match(actual, /345/);
  await page.getByRole("link", { name: "เปลี่ยนบทบาท" }).click();
  await page.getByRole("button", { name: /เข้า Demo นักศึกษา/ }).click();
  await page.getByRole("link", { name: /ประเมินบุคคล/ }).click();
  await page.getByText(/ได้รับมอบหมาย \d+ คู่/).waitFor();
  console.log("Day 3 browser: 1 preview/save/reopen/student-count flow passed, 0 failed.");
} finally { await browser.close(); }
