// Local synthetic fixtures only. Leaves existing demo users, notices and read states intact.
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

process.loadEnvFile('.env.local');
const origin = 'http://localhost:3101', endpoint = '/api/full-system/notifications';
assert.equal(process.env.PAIR_EVAL_ENV, 'development');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname), 'Loopback database only');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const roles = ['owner', 'student', 'other', 'ta', 'co', 'outsider', 'unaccepted'];
const actors = Object.fromEntries(roles.map(role => [role, { id: randomUUID(), token: randomBytes(32).toString('hex') }]));
const users = Object.values(actors).map(actor => actor.id);
const room = randomUUID(), group = randomUUID(), assignment = randomUUID(), hidden = randomUUID();
const suffix = randomUUID().slice(0, 8), dir = '.verification/notification-bell-20261017';
const checks = [], scans = [], errors = [];
let browser, context;
await mkdir(dir, { recursive: true });
function passed(name) { checks.push(name); console.log(`PASS ${name}`); }
async function api(role, method = 'GET', body, status = 200, headers = {}) {
  const response = await fetch(origin + endpoint, { method, headers: {
    Cookie: `paireval_full_session=${actors[role].token}`, Origin: origin,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers,
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, status, `notification ${role} ${method}`);
  return response.json();
}
async function scan(page, name) {
  const findings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  assert.deepEqual(findings.violations.map(item => item.id), [], name);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name);
  const panel = page.locator('#notification-panel');
  if (await panel.isVisible()) assert.ok(await panel.evaluate(el => {
    const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1;
  }), `${name} panel stays in viewport`);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  scans.push(name);
}
async function cookie(ctx, role) {
  await ctx.addCookies([{ name: 'paireval_full_session', value: actors[role].token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
}
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const role of roles) {
      const actor = actors[role], email = `bell-${role}-${suffix}@example.test`;
      await client.query(`INSERT INTO app_user(id,email_lookup,email_raw,display_name,status,can_create_classroom)
        VALUES($1,$2,$2,$3,'ACTIVE',$4)`, [actor.id, email, `ทดสอบแจ้งเตือน ${role}`, role === 'owner']);
      if (role !== 'unaccepted') await client.query(`INSERT INTO privacy_notice_acceptance(user_id,notice_version)
        VALUES($1,'synthetic-staging-v1')`, [actor.id]);
      await client.query(`INSERT INTO app_session(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')`,
        [randomUUID(), actor.id, createHash('sha256').update(actor.token).digest('hex')]);
    }
    await client.query(`INSERT INTO classroom(id,name,slug,created_by) VALUES($1,'ห้องทดสอบแจ้งเตือน',$2,$3)`, [room, `bell-${suffix}`, actors.owner.id]);
    await client.query(`INSERT INTO group_entity(id,classroom_id,name) VALUES($1,$2,'กลุ่มทดสอบ')`, [group, room]);
    for (const [role, membership] of [['owner','OWNER'],['student','STUDENT'],['other','STUDENT'],['ta','TA'],['co','CO_TEACHER']]) {
      await client.query(`INSERT INTO classroom_member(id,classroom_id,user_id,role,group_id) VALUES($1,$2,$3,$4,$5)`,
        [randomUUID(), room, actors[role].id, membership, membership === 'STUDENT' ? group : null]);
    }
    await client.query(`INSERT INTO assignment(id,classroom_id,name,slug,status,generation,created_by) VALUES($1,$2,'งานทดสอบแจ้งเตือน',$3,'OPEN',1,$4)`, [assignment, room, `bell-${suffix}`,actors.owner.id]);
    for (let i = 0; i < 105; i++) await client.query(`INSERT INTO app_notification(id,recipient_user_id,assignment_id,generation,event_type,dedupe_key,message,deep_link)
      VALUES($1,$2,$3,1,'ASSIGNMENT_PUBLISHED',$4,$5,$6)`, [randomUUID(), actors.student.id, assignment, `bell-${suffix}-${i}`, `เปิดงานประเมินแล้ว ${i+1}`, `/full-system/classrooms/${room}/work`]);
    for (const role of ['owner','other','ta','co']) await client.query(`INSERT INTO app_notification(id,recipient_user_id,assignment_id,generation,event_type,dedupe_key,message,deep_link)
      VALUES($1,$2,$3,1,$4,$5,'รายการเฉพาะบัญชี',$6)`, [randomUUID(), actors[role].id, assignment,
      role === 'owner' ? 'FINALIZE_REVIEW_REQUIRED' : 'ASSIGNMENT_PUBLISHED', `bell-${suffix}-${role}`,
      role === 'owner' ? `/full-system/assignments/${assignment}/reports` : `/full-system/classrooms/${room}/work`]);
    await client.query(`INSERT INTO app_notification(id,recipient_user_id,assignment_id,generation,event_type,dedupe_key,message,deep_link)
      VALUES($1,$2,$3,2,'ASSIGNMENT_PUBLISHED',$4,'รุ่นที่ซ่อน',$5)`, [hidden, actors.student.id, assignment, `bell-${suffix}-hidden`, `/full-system/classrooms/${room}/work`]);
    await client.query(`INSERT INTO app_notification(id,recipient_user_id,assignment_id,generation,event_type,dedupe_key,message,deep_link)
      VALUES($1,$2,$3,1,'SCORE_FINALIZED',$4,'คะแนนที่ยังไม่ Final',$5)`, [randomUUID(), actors.student.id, assignment, `bell-${suffix}-score`, `/full-system/assignments/${assignment}/my-score`]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }

  let feed = await api('student');
  assert.equal(feed.data.length, 100); assert.deepEqual(feed.meta, { totalCount: 105, unreadCount: 105 });
  assert.equal(feed.data[0].classroomName, 'ห้องทดสอบแจ้งเตือน'); assert.equal(feed.data[0].assignmentTitle, 'งานทดสอบแจ้งเตือน');
  assert.ok(feed.data.every(item => item.event === 'ASSIGNMENT_PUBLISHED'));
  passed('latest 100 with exact counts/context; stale generation and unfinalized score hidden');
  const notice = feed.data[0].id;
  await api('other','POST',{ id: notice },404); await api('student','POST',{ id: hidden },404);
  await api('student','POST',{ id: 'invalid' },404); await api('student','POST',{ id: notice, all: true },422);
  await api('student','POST',{ all: false },422); await api('student','POST',{ all: true },403,{ Origin: 'https://invalid.example' });
  await api('unaccepted','GET',undefined,428);
  assert.equal((await fetch(origin+endpoint)).status,401);
  passed('cross-account, hidden ID, malformed body, origin, privacy and anonymous guards');
  await api('student','POST',{ id: notice }); await api('student','POST',{ id: notice });
  assert.equal((await api('student')).meta.unreadCount,104);
  assert.equal((await api('student','POST',{all:true})).data.updatedCount,104);
  assert.equal((await api('student')).meta.unreadCount,0);
  assert.equal((await pool.query('SELECT read_at FROM app_notification WHERE id=$1',[hidden])).rows[0].read_at,null);
  assert.equal((await api('other')).meta.unreadCount,1);
  passed('idempotent single read; bulk read includes older than 100 and preserves hidden/other recipients');
  for (const role of ['ta','co','outsider']) assert.deepEqual((await api(role)).meta,{totalCount:0,unreadCount:0});
  assert.equal((await api('owner')).data[0].deepLink,`/full-system/assignments/${assignment}/reports`);
  passed('existing teacher event deep link and empty TA/Co/outsider feeds');
  for (const [name,apply,undo] of [
    ['withdrawn membership',`UPDATE classroom_member SET membership_status='WITHDRAWN',withdrawn_at=now() WHERE classroom_id=$1 AND user_id='${actors.student.id}'`,`UPDATE classroom_member SET membership_status='ACTIVE',withdrawn_at=NULL WHERE classroom_id=$1`],
    ['archived room',`UPDATE classroom SET status='ARCHIVED' WHERE id=$1`,`UPDATE classroom SET status='ACTIVE' WHERE id=$1`],
    ['email domain restriction',`UPDATE classroom SET allowed_email_domains=ARRAY['denied.example'] WHERE id=$1`,`UPDATE classroom SET allowed_email_domains='{}' WHERE id=$1`],
  ]) {
    await pool.query(apply,[room]);
    assert.equal((await api('student')).meta.totalCount,0); assert.equal((await api('student','POST',{all:true})).data.updatedCount,0);
    await pool.query(undo,[room]); passed(name+' affects listing, counts and mutations');
  }
  await pool.query('UPDATE app_notification SET read_at=NULL WHERE assignment_id=$1 AND recipient_user_id=$2',[assignment,actors.student.id]);
  browser = await chromium.launch(); context = await browser.newContext({viewport:{width:1280,height:900}});
  await context.route('**/*',route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await cookie(context,'student'); const page = await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/full-system'); const bell=page.getByRole('button',{name:/^การแจ้งเตือน/}),panel=page.locator('#notification-panel');
  await expect(bell).toHaveAccessibleName('การแจ้งเตือน ยังไม่อ่าน 105 รายการ'); await expect(bell.locator('.fs-bell-badge')).toHaveText('99+');
  await bell.focus(); await page.keyboard.press('Enter'); await expect(panel).toBeVisible(); await expect(panel.locator('li')).toHaveCount(100);
  await scan(page,'student-desktop'); await page.keyboard.press('Tab'); await expect(page.getByRole('button',{name:'ปิดการแจ้งเตือน',exact:true})).toBeFocused();
  await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(bell).toBeFocused();
  await bell.click(); await page.getByRole('button',{name:'อ่านทั้งหมดแล้ว',exact:true}).click();
  await expect(bell).toHaveAccessibleName('การแจ้งเตือน'); await expect(bell.locator('.fs-bell-badge')).toHaveCount(0);
  await page.reload(); await bell.click(); await expect(panel.getByText('ยังไม่อ่าน 0 รายการ',{exact:true})).toBeVisible();
  passed('badge 99+, keyboard open/close/focus, bulk read and persistence through GUI');
  await page.locator('.fs-account-menu > summary').click(); await expect(panel).toBeHidden();
  await bell.click(); await expect(page.locator('.fs-account-menu')).not.toHaveAttribute('open','');
  await page.getByRole('heading',{name:'เลือกห้องเรียน',exact:true}).click(); await expect(panel).toBeHidden();
  passed('account menu mutual exclusion and outside click');
  for (const width of [390,320]) { await page.setViewportSize({width,height:844}); await bell.click(); await scan(page,`student-${width}`); await page.keyboard.press('Escape'); }
  await page.setViewportSize({width:1280,height:900});
  await pool.query('UPDATE app_notification SET read_at=NULL WHERE id=$1',[notice]); await page.reload();
  await expect(bell).toHaveAccessibleName('การแจ้งเตือน ยังไม่อ่าน 1 รายการ'); await bell.click();
  await panel.locator('li').filter({hasText:'ยังไม่อ่าน'}).getByRole('link').click();
  await expect(page).toHaveURL(origin+`/full-system/classrooms/${room}/work`); await expect(bell).toHaveAccessibleName('การแจ้งเตือน');
  await bell.click(); await scan(page,'student-work-page'); passed('single click marks read and navigates correctly; available beyond home');
  for (const fault of ['server','network','rate']) {
    let attempts=0;
    await page.route('**/api/full-system/notifications',route => { attempts++; return fault==='network' ? route.abort() : route.fulfill({status:fault==='rate'?429:503,headers:{'Content-Type':'application/json',...(fault==='rate'?{'Retry-After':'1'}:{})},body:'{}'}); });
    await page.reload(); await bell.click(); await expect(panel.getByRole('alert')).toBeVisible(); await scan(page,'error-'+fault);
    if(fault==='rate') { const before=attempts; await panel.getByRole('button',{name:'ลองใหม่',exact:true}).click(); assert.equal(attempts,before,'Retry-After prevents early requests'); }
    await page.unroute('**/api/full-system/notifications');
    if(fault==='rate') await page.waitForTimeout(10_100);
    await panel.getByRole('button',{name:'ลองใหม่',exact:true}).click(); await expect(panel.getByRole('alert')).toHaveCount(0); await expect(panel.locator('li')).toHaveCount(100);
    passed(fault+' failure and retry recover with same session');
  }
  await cookie(context,'other'); await page.reload(); await bell.click(); await expect(panel.locator('li')).toHaveCount(1);
  await page.route('**/api/full-system/notifications',route => route.request().method()==='POST' ? route.fulfill({status:503,contentType:'application/json',body:'{}'}) : route.continue());
  await panel.getByRole('button',{name:'อ่านทั้งหมดแล้ว',exact:true}).click(); await expect(panel.getByRole('alert')).toBeVisible();
  await expect(bell).toHaveAccessibleName('การแจ้งเตือน ยังไม่อ่าน 1 รายการ');
  await panel.getByRole('link').click(); await expect(page).toHaveURL(origin+`/full-system/classrooms/${room}/work`);
  assert.equal((await api('other')).meta.unreadCount,1); await page.unroute('**/api/full-system/notifications');
  passed('failed read does not decrement badge and still allows target navigation');
  await page.clock.install();
  for (const role of ['owner','ta','co']) {
    await cookie(context,role); await page.goto(origin+'/full-system'); await bell.click();
    await expect(panel.locator('li')).toHaveCount(role==='owner'?1:0); if(role!=='owner') await expect(panel.getByText('ยังไม่มีการแจ้งเตือน',{exact:true})).toBeVisible();
    await scan(page,role+'-feed');
  }
  let automaticLoads=0; page.on('request',request=>{if(request.url()===origin+endpoint && request.method()==='GET')automaticLoads++;});
  await page.clock.runFor(60_100); await expect.poll(()=>automaticLoads).toBe(1);
  await page.keyboard.press('Escape'); await page.getByRole('navigation',{name:'เมนูหลัก'}).getByRole('link',{name:'ห้องเรียนที่เก็บแล้ว',exact:true}).click();
  await expect(page).toHaveURL(origin+'/full-system/archive');
  await page.getByRole('button',{name:/^การแจ้งเตือน/}).click(); assert.equal(automaticLoads,1,'path and open requests coalesced within cooldown');
  passed('visible 60-second refresh and navigation/open cooldown');
  await cookie(context,'unaccepted'); await page.goto(origin+'/full-system'); await expect(bell).toHaveCount(0);
  await cookie(context,'owner'); await page.goto(origin+'/full-system'); await expect(bell).toBeVisible();
  await page.locator('.fs-account-menu > summary').click(); await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
  await expect(bell).toHaveCount(0); passed('role switch clears prior feed; privacy-required and logout hide bell');
  // Real browser zoom, using Chromium's extension API rather than CSS scaling.
  await context.close(); context=undefined; await browser.close(); browser=undefined;
  const extension=resolve(dir,'zoom-extension'); await mkdir(extension,{recursive:true});
  await writeFile(extension+'/manifest.json',JSON.stringify({manifest_version:3,name:'Local zoom check',version:'1.0',permissions:['tabs'],background:{service_worker:'worker.js'}}));
  await writeFile(extension+'/worker.js','chrome.runtime.onInstalled.addListener(() => {});');
  context=await chromium.launchPersistentContext(resolve(dir,'zoom-profile'),{channel:'chromium',headless:true,viewport:null,args:['--window-size=1000,900',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  await cookie(context,'student'); const zoomPage=await context.newPage(); await zoomPage.goto(origin+'/full-system');
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  const zoom=await worker.evaluate(async()=>{const tab=(await chrome.tabs.query({})).find(tab=>tab.url?.startsWith('http://localhost:3101'));await chrome.tabs.setZoom(tab.id,2);return chrome.tabs.getZoom(tab.id);});
  assert.equal(zoom,2); await expect.poll(()=>zoomPage.evaluate(()=>devicePixelRatio)).toBe(2);
  await zoomPage.getByRole('button',{name:/^การแจ้งเตือน/}).click(); await scan(zoomPage,'browser-zoom-200');
  assert.equal(await zoomPage.evaluate(()=>getComputedStyle(document.documentElement).zoom),'1'); passed('real browser zoom 200%');
  assert.deepEqual(errors,[]);
} finally {
  await context?.close(); await browser?.close();
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM app_notification WHERE assignment_id=$1',[assignment]);
    await client.query('DELETE FROM assignment WHERE id=$1',[assignment]);
    await client.query('DELETE FROM classroom_member WHERE classroom_id=$1',[room]);
    await client.query('DELETE FROM group_entity WHERE classroom_id=$1',[room]);
    await client.query('DELETE FROM classroom WHERE id=$1',[room]);
    await client.query('DELETE FROM api_rate_window WHERE user_id=ANY($1::uuid[])',[users]);
    await client.query('DELETE FROM app_session WHERE user_id=ANY($1::uuid[])',[users]);
    await client.query('DELETE FROM privacy_notice_acceptance WHERE user_id=ANY($1::uuid[])',[users]);
    await client.query('DELETE FROM app_user WHERE id=ANY($1::uuid[])',[users]);
    await client.query('COMMIT');
    const remaining=Number((await client.query('SELECT count(*) AS n FROM classroom WHERE id=$1',[room])).rows[0].n);
    await writeFile(dir+'/results.json',JSON.stringify({checks,scans,pageErrors:errors,fixtureRoomsRemaining:remaining,complete:checks.includes('real browser zoom 200%')},null,2));
    console.log(JSON.stringify({checks:checks.length,scans:scans.length,pageErrors:errors.length,fixtureRoomsRemaining:remaining}));
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();await pool.end();}
}
