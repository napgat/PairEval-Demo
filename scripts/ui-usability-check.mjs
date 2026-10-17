import {chromium, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const options=Object.fromEntries(process.argv.slice(2).map(arg=>{const [key,...rest]=arg.replace(/^--/,'').split('=');return[key,rest.join('=')];}));
const origin=options.origin??'http://localhost:3101', portal='http://localhost:3103';
assert.ok(['http://localhost:3101','http://localhost:3102'].includes(origin),'Synthetic loopback UI only');
const state=JSON.parse(await readFile(options.state??'.verification/v20-20261015/presentation-state.json','utf8'));
let final=null;
try{final=JSON.parse(await readFile(options.final??'.verification/presentation-final-v1.json','utf8'));assert.equal(final.classroomId,state.room);}catch(error){if(error.code!=='ENOENT')throw error;}
let finalReady=false;const skipped=[];
const dir='.verification/ui-usability-20261016';await mkdir(dir,{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
const checks=[],errors=[];
const skip=(scope,reason)=>{skipped.push({scope,reason});console.log(JSON.stringify({skipped:scope,reason}));};
page.on('pageerror',error=>errors.push(error.message));
await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
async function enter(name){
 await page.goto(portal);await page.locator('article').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button').click();
 await page.waitForURL('http://localhost:3101/full-system');if(origin!=='http://localhost:3101')await page.goto(origin+'/full-system');
 await expect(page.getByRole('heading',{name:'เลือกห้องเรียน',exact:true})).toBeVisible();
 await expect(page.locator('.fs-account-menu > summary').getByText(name,{exact:true})).toBeVisible();
}
async function scan(name){
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 const item={page:name,violations:result.violations,viewport:page.viewportSize(),horizontalOverflow:overflow};checks.push(item);
 await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
 console.log(JSON.stringify({page:name,violations:result.violations.map(v=>v.id),horizontalOverflow:overflow}));
}
const assignmentUrl=origin+`/full-system/classrooms/${state.room}/assignments`;
const workUrl=origin+`/full-system/classrooms/${state.room}/work`;
const reportUrl=origin+`/full-system/assignments/${state.assignment}/reports`;
try{
 await page.goto(origin+'/full-system');await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ PairEval',exact:true})).toBeVisible();await scan('sign-in');
 await enter('อาจารย์เจ้าของห้อง');await scan('owner-dashboard');
 await page.getByRole('button',{name:/^การแจ้งเตือน/}).click();await expect(page.locator('#notification-panel')).toBeVisible();await expect(page.locator('#notification-panel').getByText('กำลังโหลดการแจ้งเตือน…',{exact:true})).toHaveCount(0);await scan('owner-notification-panel');await page.keyboard.press('Escape');
 if(final){const response=await page.request.get(origin+`/api/full-system/assignments/${final.assignmentId}/score-runs`);assert.ok(response.ok(),'Prepared Final fixture must be readable');const payload=await response.json();finalReady=payload.data?.assignmentStatus==='FINALIZED';}
 if(!finalReady)skip('final-report-and-final-score','No finalized synthetic assignment; follow docs/TRY_IT.md section D, then rerun. Main-score screens will still be checked.');
 await page.goto(assignmentUrl);await expect(page.getByRole('button').filter({hasText:'ประเมินผลงานโครงงาน — ข้อมูลจำลอง'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'ชื่องาน',exact:true})).not.toBeVisible();await scan('owner-assignments');
 await page.getByRole('button',{name:'＋ สร้างงานใหม่',exact:true}).click();await expect(page.getByRole('textbox',{name:'ชื่องาน',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'ชื่องาน',exact:true})).toBeFocused();await scan('owner-new-assignment');
 await page.goto(reportUrl);await expect(page.getByRole('tab',{name:'คะแนนกลุ่ม',exact:true})).toBeVisible();await scan('report-group');
 await page.getByRole('tab',{name:'คะแนนกลุ่ม',exact:true}).press('ArrowRight');await expect(page.getByRole('tabpanel',{name:'คะแนนรายบุคคล',exact:true})).toBeVisible();await scan('report-individual');
 await page.getByRole('tab',{name:'ความครอบคลุมคู่',exact:true}).click();await scan('report-coverage');
 await page.getByRole('tab',{name:'คุณภาพคำตอบ',exact:true}).click();await scan('report-quality');
 await page.getByRole('button',{name:'ยืนยันผลคะแนน',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await scan('owner-final-confirmation');
 await page.getByRole('dialog').getByRole('button',{name:'กลับไปตรวจสอบ',exact:true}).press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 if(finalReady){await page.goto(origin+`/full-system/assignments/${final.assignmentId}/reports`);await expect(page.getByText('ยืนยันแล้ว',{exact:true})).toBeVisible();
 await expect(page.getByText('เปิดทบทวนคะแนนที่ยืนยันแล้ว',{exact:true})).toBeVisible();await scan('report-final');}
 await enter('ผู้สอนร่วม');await page.goto(origin+`/full-system/assignments/${finalReady?final.assignmentId:state.assignment}/reports`);await expect(page.getByRole('tab',{name:'คะแนนกลุ่ม',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'ยืนยันผลคะแนน',exact:true})).toHaveCount(0);await expect(page.getByText('เปิดทบทวนคะแนนที่ยืนยันแล้ว',{exact:true})).toHaveCount(0);await scan('co-teacher-report');
 await enter('ผู้ช่วยสอน');await page.locator(`a[href="/full-system/classrooms/${state.room}/roster"]`).click();await expect(page.getByRole('cell',{name:'นักศึกษาคนที่ 1',exact:true})).toBeVisible();
 await page.getByRole('searchbox',{name:'ค้นหานักศึกษา',exact:true}).fill('S001');await expect(page.locator('tbody tr')).toHaveCount(1);await page.getByRole('searchbox',{name:'ค้นหานักศึกษา',exact:true}).fill('');await scan('ta-roster');
 await enter('นักศึกษาคนที่ 1');await scan('student-dashboard');
 await page.getByRole('button',{name:/^การแจ้งเตือน/}).click();await expect(page.locator('#notification-panel')).toBeVisible();await expect(page.locator('#notification-panel').getByText('กำลังโหลดการแจ้งเตือน…',{exact:true})).toHaveCount(0);await scan('student-notification-panel');await page.keyboard.press('Escape');
 await page.goto(workUrl);await expect(page.getByRole('heading',{name:'ประเมินผลงานโครงงาน — ข้อมูลจำลอง',exact:true})).toBeVisible();
 await page.getByRole('searchbox',{name:'ค้นหางานประเมิน',exact:true}).fill('ไม่พบคำนี้');await expect(page.getByRole('heading',{name:'ไม่พบงานที่ตรงกับการค้นหา',exact:true})).toBeVisible();await page.getByRole('button',{name:'ดูงานทั้งหมด',exact:true}).click();await scan('student-work');
 await page.goto(origin+`/full-system/assignments/${state.assignment}/evaluate/group?classroom=${state.room}`);await expect(page.getByRole('radio').first()).toBeVisible();await scan('student-group');
 const submit=page.locator('.fs-submit-actions').getByRole('button',{name:/^(ส่งฉบับแก้ไข|ยืนยันส่งคำตอบ)$/});
 if(await submit.count()){await submit.click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByRole('button',{name:'กลับไปตรวจสอบ',exact:true})).toBeFocused();await scan('student-submit-confirmation');
 await page.getByRole('dialog').getByRole('button',{name:'กลับไปตรวจสอบ',exact:true}).press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(submit).toBeFocused();}else skip('submit-dialog','The main assignment is closed; no editable submission control.');
 await page.goto(origin+`/full-system/assignments/${state.assignment}/evaluate/individual?classroom=${state.room}`);await expect(page.getByRole('radio').first()).toBeVisible();await scan('student-individual');
 const scoreAssignment=finalReady?final.assignmentId:state.assignment;
 const scoreResponse=await page.request.get(origin+`/api/full-system/assignments/${scoreAssignment}/my-score`);assert.ok(scoreResponse.ok());const score=(await scoreResponse.json()).data;
 await page.goto(origin+`/full-system/assignments/${scoreAssignment}/my-score?classroom=${state.room}`);
 const expectedTotal=score.total===null?'รอผลประเมิน':score.total.toFixed(2);
 await expect(page.locator('.fs-total-score strong')).toHaveText(expectedTotal);
 if(finalReady)await expect(page.getByText('อาจารย์ยืนยันคะแนนแล้ว',{exact:true})).toBeVisible();await scan(finalReady?'student-final-score':'student-interim-score');
 await page.goto(origin+'/full-system/archive');await expect(page.getByRole('heading',{name:'ยังไม่มีห้องเรียนที่เก็บแล้ว',exact:true})).toBeVisible();await scan('student-archive');
 await page.setViewportSize({width:390,height:844});await page.goto(workUrl);await expect(page.getByRole('heading',{name:'ประเมินผลงานโครงงาน — ข้อมูลจำลอง',exact:true})).toBeVisible();await scan('mobile-student-work');
 await page.goto(origin+`/full-system/assignments/${state.assignment}/evaluate/group?classroom=${state.room}`);await expect(page.getByRole('radio').first()).toBeVisible();await expect(page.locator('.fs-submit-bar')).toHaveCSS('position','static');await scan('mobile-student-group');
 await page.setViewportSize({width:320,height:740});await page.goto(origin+`/full-system/assignments/${scoreAssignment}/my-score?classroom=${state.room}`);await expect(page.locator('.fs-total-score strong')).toHaveText(expectedTotal);await scan('small-student-score');
 const passed=checks.every(c=>c.violations.length===0&&!c.horizontalOverflow)&&errors.length===0;
 await writeFile(dir+'/results.json',JSON.stringify({passed,origin,checks,errors,skipped,readOnlyHarness:true,scoreCheck:'UI matches its own API snapshot; this is not an independent scoring oracle'},null,2));
 assert.ok(passed,'UI/accessibility findings; inspect the recorded results');console.log(JSON.stringify({passed,pages:checks.length,errors:errors.length,skipped}));
}catch(error){await writeFile(dir+'/results.json',JSON.stringify({passed:false,origin,checks,errors,skipped,failure:error.message},null,2));throw error;}finally{await browser.close();}
