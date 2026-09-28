import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base);
  await page.getByRole("button", { name: /เข้า Demo ผู้สอน/ }).click();
  await page.getByRole("link", { name: /สร้างห้องและนำเข้า CSV/ }).click();
  await page.getByLabel("ชื่อห้องเรียน").fill("ห้องทดสอบผ่านหน้าจอ");
  await page.getByLabel("หรือวาง CSV ที่นี่").fill("email,groupname\nbrowser-a@demo.invalid,Orion\nbrowser-b@demo.invalid,Nova");
  await page.getByRole("button", { name: "ตรวจตัวอย่าง CSV" }).click();
  await page.getByText(/ตัวอย่างผ่าน: 2 คน \/ 2 กลุ่ม/).waitFor();
  await page.getByRole("button", { name: "สร้างห้องและนำเข้ารายชื่อ" }).click();
  await page.waitForURL(/\/demo\/instructor\/classroom\//);
  assert.ok((await page.getByText("ห้องทดสอบผ่านหน้าจอ").count()) > 0);
  await page.getByRole("link", { name: /สร้างงาน/ }).last().click();
  await page.getByLabel("ชื่องาน").fill("งานทดสอบผ่านหน้าจอ");
  await page.getByLabel("น้ำหนัก %").first().fill("90");
  await page.getByRole("button", { name: "สร้างงานประเมิน" }).click();
  await page.getByText(/น้ำหนักรวมต้องเท่ากับ 100%/).waitFor();
  assert.match(page.url(), /\/assignments\/new\//);
  await page.getByLabel("น้ำหนัก %").first().fill("100");
  await page.getByRole("button", { name: "สร้างงานประเมิน" }).click();
  await page.waitForURL(/\/demo\/instructor\/assignment\//);
  assert.ok((await page.getByRole("heading", { name: "งานทดสอบผ่านหน้าจอ" }).count()) === 1);
  console.log("Day 2 browser: 1 main UI flow passed, 0 failed (CSV preview → classroom → invalid weight → valid assignment).");
} finally { await browser.close(); }
