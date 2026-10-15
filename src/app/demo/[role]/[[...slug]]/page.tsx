import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readDemoSnapshot, type DemoSnapshot } from "@/lib/demo-data";
import { currentActor } from "@/lib/demo-session";
import ClassroomForm from "../../components/classroom-form";
import AssignmentForm from "../../components/assignment-form";
import PairingPanel from "../../components/pairing-panel";
import { openDemoDb } from "@/lib/demo-data";
import { getPairingPreview } from "@/lib/pairing-store";
import { getEvaluationView } from "@/lib/evaluation-store";
import EvaluationPanel from "../../components/evaluation-panel";
import { formatScore, getAssignmentScore, getPairAnswerCoverage, mayViewOwnScore, mayViewReport, scoreStatus, ownScoreView } from "@/lib/score-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "instructor" | "student";
type Props = { params: Promise<{ role: string; slug?: string[] }> };

function href(role: Role, ...parts: string[]) { return `/demo/${role}${parts.length ? `/${parts.join("/")}` : ""}`; }

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

function Status({ children }: { children: React.ReactNode }) {
  return <p className="status"><span className="status-dot" />{children}</p>;
}

function Nav({ role, classId, assignmentId }: { role: Role; classId: string; assignmentId: string }) {
  const items: [string, string][] = role === "instructor" ? [
    ["ห้องเรียน", href(role)],
    ["สร้างห้อง + CSV", href(role, "classrooms", "new")],
    ["รายละเอียดห้อง", href(role, "classroom", classId)],
    ["รายชื่อ/กลุ่ม", href(role, "roster", classId)],
    ["สร้างงาน", href(role, "assignments", "new", classId)],
    ...(assignmentId ? [["งานประเมิน", href(role, "assignment", assignmentId)], ["สร้างคู่", href(role, "pairing", assignmentId)], ["รายงาน", href(role, "report", assignmentId)], ["ส่งออก CSV", href(role, "export", assignmentId)]] as [string, string][] : []),
    ["ฟีเจอร์รอง", href(role, "extras")],
  ] : [
    ["ห้องเรียน", href(role)],
    ["รายละเอียดห้อง", href(role, "classroom", classId)],
    ...(assignmentId ? [["งานประเมิน", href(role, "assignment", assignmentId)], ["ประเมินกลุ่ม", href(role, "evaluation", "group", assignmentId)], ["ประเมินบุคคล", href(role, "evaluation", "individual", assignmentId)], ["คะแนนของฉัน", href(role, "score", assignmentId)]] as [string, string][] : []),
  ];
  return <nav className="sidebar" aria-label="หน้าจอสาธิต"><p className="nav-label">หน้าจอหลัก</p>{items.map(([label, url]) => <Link key={url} href={url}>{label}<span>↗</span></Link>)}</nav>;
}

function MainContent({ role, slug, data, classId, actorId }: { role: Role; slug: string[]; data: DemoSnapshot; classId: string; actorId: string }) {
  const [section, id, maybeAssignment] = slug;
  const classroom = data.classrooms.find(c => c.id === (section === "classroom" || section === "roster" ? id : classId));
  const assignment = data.assignments.find(a => a.id === (section === "assignment" || section === "pairing" || section === "report" || section === "export" || section === "score" ? id : maybeAssignment));
  const studentId = actorId;
  const studentClassIds = new Set(data.memberships.filter(m => m.user_id === studentId).map(m => m.classroom_id));

  if (section === "classrooms" && id === "new" && role === "instructor") return <><h1>สร้างห้องเรียน</h1><p className="intro">นำเข้า CSV หลังตรวจตัวอย่าง ทุกแถวจะบันทึกพร้อมกันเมื่อข้อมูลถูกต้องทั้งหมด</p><ClassroomForm /></>;
  if (section === "assignments" && id === "new" && role === "instructor") {
    const targetClassroom = data.classrooms.find(c => c.id === maybeAssignment);
    if (!targetClassroom) notFound();
    return <><h1>สร้างงานประเมิน</h1><p className="intro">ระบุคะแนนรวม เกณฑ์ของ Group/Individual และกำหนดส่ง</p><AssignmentForm classroomId={targetClassroom.id} classroomName={targetClassroom.name} /></>;
  }

  if (!section) {
    const visible = role === "instructor" ? data.classrooms : data.classrooms.filter(c => data.memberships.some(m => m.classroom_id === c.id && m.user_id === studentId));
    return <><h1>ห้องเรียน</h1><p className="intro">{role === "instructor" ? "รายการห้องที่ผู้สอนตัวอย่างดูแล" : `ห้องของ ${data.users.find(user => user.id === actorId)?.display_name ?? "นักศึกษา"}`}</p>{role === "instructor" && <Link className="primary-button inline-button" href={href(role, "classrooms", "new")}>+ สร้างห้องและนำเข้า CSV</Link>}<div className="cards">{visible.map(c => <Link className="card-link" key={c.id} href={href(role, "classroom", c.id)}><span className="eyebrow">{c.demo_case === "feasible" ? "ชุดข้อมูลจัดคู่ได้" : c.demo_case === "infeasible" ? "กรณีจัดคู่ไม่ได้" : "ห้องที่สร้างใหม่"}</span><strong>{c.name}</strong><small>{data.groups.filter(g => g.classroom_id === c.id).length} กลุ่ม · {data.memberships.filter(m => m.classroom_id === c.id).length} นักศึกษา</small></Link>)}</div></>;
  }
  if (section === "classroom" && classroom && (role === "instructor" || studentClassIds.has(classroom.id))) {
    const thisAssignments = data.assignments.filter(a => a.classroom_id === classroom.id);
    const ownMembership = data.memberships.find(m => m.classroom_id === classroom.id && m.user_id === studentId);
    return <><h1>{classroom.name}</h1><p className="intro">{classroom.demo_case === "feasible" ? "3 กลุ่ม กลุ่มละ 7 คน เป็นชุดตัวอย่างสำหรับตรวจ feasibility ของทั้ง Group และ Individual" : classroom.demo_case === "infeasible" ? "2 กลุ่ม กลุ่มละ 2 คน เป็นกรณีที่ต้องอธิบายว่าไม่สามารถจัดคู่ตามกติกาได้" : "ห้องที่นำเข้าด้วย CSV"}</p><div className="cards"><Panel title="สมาชิก"><p>{data.memberships.filter(m => m.classroom_id === classroom.id).length} คนใน {data.groups.filter(g => g.classroom_id === classroom.id).length} กลุ่ม</p>{role === "instructor" ? <Link className="text-link" href={href(role, "roster", classroom.id)}>ดูรายชื่อและกลุ่ม →</Link> : <p>กลุ่มของคุณ: {data.groups.find(g => g.id === ownMembership?.group_id)?.name}</p>}</Panel><Panel title="งานประเมิน">{thisAssignments.length ? thisAssignments.map(item => <p key={item.id}><Link className="text-link" href={href(role, "assignment", item.id)}>{item.name} →</Link></p>) : <p>ยังไม่มีงานประเมิน</p>}{role === "instructor" && <Link className="primary-button inline-button" href={href(role, "assignments", "new", classroom.id)}>+ สร้างงาน</Link>}</Panel></div></>;
  }
  if (section === "roster" && role === "instructor" && classroom) {
    return <><h1>รายชื่อและกลุ่ม</h1><p className="intro">{classroom.name} · ข้อมูลสังเคราะห์</p><div className="cards">{data.groups.filter(g => g.classroom_id === classroom.id).map(g => <Panel key={g.id} title={g.name}><ul className="plain-list">{data.memberships.filter(m => m.group_id === g.id).map(m => { const user = data.users.find(u => u.id === m.user_id); return <li key={m.user_id}>{user?.display_name} <small>{user?.email}</small></li>; })}</ul></Panel>)}</div></>;
  }
  if (section === "assignment" && assignment && (role === "instructor" || studentClassIds.has(assignment.classroom_id))) {
    const criteria = data.criteria.filter(c => c.assignment_id === assignment.id);
    return <><h1>{assignment.name}</h1><p className="intro">คะแนนรวม {assignment.group_max + assignment.individual_max} · Group {assignment.group_max} · Individual {assignment.individual_max}</p><div className="cards"><Panel title="เกณฑ์กลุ่ม">{criteria.filter(c => c.kind === "group").map(c => <p key={c.id}>{c.name} <strong>{c.weight_percent}%</strong></p>)}</Panel><Panel title="เกณฑ์บุคคล">{criteria.filter(c => c.kind === "individual").map(c => <p key={c.id}>{c.name} <strong>{c.weight_percent}%</strong></p>)}</Panel></div><Panel title="กำหนดส่ง"><p>Group: {new Date(assignment.group_deadline).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p><p>Individual: {new Date(assignment.individual_deadline).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p></Panel>{role === "instructor" ? <Link className="primary-button inline-button" href={href(role, "pairing", assignment.id)}>ตรวจและสร้างคู่ →</Link> : <div className="actions"><Link className="primary-button" href={href(role, "evaluation", "group", assignment.id)}>ประเมินกลุ่ม</Link><Link className="secondary-button" href={href(role, "evaluation", "individual", assignment.id)}>ประเมินบุคคล</Link></div>}</>;
  }
  if (section === "pairing" && role === "instructor" && assignment) {
    const db = openDemoDb({ readOnly: true });
    const preview = getPairingPreview(db, assignment.id);
    db.close();
    if (!preview) notFound();
    return <><h1>สร้างคู่และตรวจความเป็นไปได้</h1><p className="intro">{assignment.name} · preview ตรวจทุกเกณฑ์ก่อนบันทึก</p><PairingPanel initial={preview} /></>;
  }
  if (section === "report" && role === "instructor" && assignment) {
    const db = openDemoDb({ readOnly: true });
    try {
      if (!mayViewReport(db, assignment.id, actorId)) notFound();
      const score = getAssignmentScore(db, assignment.id);
      if (!score) notFound();
      const groupNames = new Map(score.result.groups.map(group => [group.id, group.name]));
      return <><h1>รายงานผู้สอน</h1><p className="intro">{assignment.name} · {scoreStatus(score)} · คะแนนคำนวณจาก submission ล่าสุด</p>
        {score.result.hasNoData && <div className="evaluation-warning">NO_DATA/คะแนนชั่วคราว: ยังมี item ที่ไม่มีคำตอบหรือไม่สามารถ normalize ได้</div>}
        <div className="actions"><Link className="secondary-button" href={href(role, "pairing", assignment.id)}>ดูคู่และ coverage</Link><Link className="primary-button" href={href(role, "export", assignment.id)}>ส่งออก CSV</Link></div>
        <Panel title="คะแนนตั้งต้นของกลุ่ม"><div className="table-wrap"><table className="score-table"><thead><tr><th>กลุ่ม</th><th>คะแนน Group</th></tr></thead><tbody>{score.result.groups.map(group => <tr key={group.id}><td>{group.name}</td><td>{formatScore(group.baseScore)}</td></tr>)}</tbody></table></div></Panel>
        <Panel title="คะแนนรายคน"><div className="table-wrap"><table className="score-table"><thead><tr><th>นักศึกษา</th><th>กลุ่ม</th><th>Group</th><th>Individual</th><th>รวม</th><th>ส่ง Group</th><th>ส่ง Individual</th></tr></thead><tbody>{score.result.students.map(student => <tr key={student.id}><td>{student.name}</td><td>{groupNames.get(student.groupId)}</td><td>{formatScore(student.groupScore)}</td><td>{formatScore(student.individualScore)}</td><td>{formatScore(student.total)}</td><td>{student.groupAnswered}/{student.groupAssigned}</td><td>{student.individualAnswered}/{student.individualAssigned}</td></tr>)}</tbody></table></div></Panel>
        <Panel title="เกณฑ์และจำนวนผลประเมินต่อ item"><div className="table-wrap"><table className="score-table"><thead><tr><th>ชนิด</th><th>เกณฑ์</th><th>item</th><th>คำตอบ / มอบหมาย</th><th>คะแนนเกณฑ์</th></tr></thead><tbody>{score.result.items.map(item => <tr key={`${item.criterionId}/${item.itemId}`}><td>{item.kind}</td><td>{item.criterionName}</td><td>{item.itemName}</td><td>{item.answerCount}/{item.assignedCount}</td><td>{formatScore(item.points)}</td></tr>)}</tbody></table></div></Panel>
        <Panel title="จำนวนคำตอบต่อคู่"><div className="table-wrap"><table className="score-table"><thead><tr><th>ชนิด</th><th>เกณฑ์</th><th>คู่</th><th>ตอบ / มอบหมาย</th><th>สถานะ</th></tr></thead><tbody>{getPairAnswerCoverage(db, assignment.id).map((pair, index) => <tr key={index}><td>{pair.kind}</td><td>{pair.criterionName}</td><td>{pair.itemAName} ↔ {pair.itemBName}</td><td>{pair.answered}/{pair.assigned}</td><td>{pair.answered === pair.assigned ? "ครบ" : "รอคำตอบ"}</td></tr>)}</tbody></table></div></Panel>
      </>;
    } finally { db.close(); }
  }
  if (section === "export" && role === "instructor" && assignment) {
    const db = openDemoDb({ readOnly: true });
    try { if (!mayViewReport(db, assignment.id, actorId)) notFound(); } finally { db.close(); }
    return <><h1>ส่งออกคะแนน</h1><Panel title="CSV summary"><p>สรุปคะแนน Group/Individual/รวม พร้อมจำนวนคู่ที่ตอบจาก submission ล่าสุด ค่าที่คำนวณไม่ได้แสดง NO_DATA</p><a className="primary-button inline-button" href={`/api/assignments/${encodeURIComponent(assignment.id)}/export`}>ดาวน์โหลด CSV</a></Panel></>;
  }
  if (section === "evaluation" && role === "student" && ["group", "individual"].includes(id) && assignment && studentClassIds.has(assignment.classroom_id)) {
    const db = openDemoDb({ readOnly: true });
    const view = getEvaluationView(db, assignment.id, id as "group" | "individual", actorId);
    db.close();
    if (!view) notFound();
    return <><h1>{id === "group" ? "ประเมินกลุ่ม" : "ประเมินบุคคล"}</h1><p className="intro">{assignment.name} · {data.users.find(user => user.id === actorId)?.display_name}</p><EvaluationPanel initial={view} /></>;
  }
  if (section === "score" && role === "student" && assignment && studentClassIds.has(assignment.classroom_id)) {
    const db = openDemoDb({ readOnly: true });
    try {
      if (!mayViewOwnScore(db, assignment.id, actorId)) notFound();
      const score = getAssignmentScore(db, assignment.id);
      const computed = score?.result.students.find(student => student.id === actorId);
      if (!score || !computed) notFound();
      const own = ownScoreView(computed);
      return <><h1>คะแนนของฉัน</h1><p className="intro">{assignment.name} · {scoreStatus(score)} — {scoreStatus(score) === "Interim" ? "อาจเปลี่ยนแปลงได้" : "สิ้นสุดกำหนดส่ง"}</p>
        {(own.groupScore === null || own.individualScore === null) && <div className="evaluation-warning">NO_DATA/คะแนนชั่วคราว: ยังมีผลประเมินไม่พอสำหรับคำนวณบางส่วน</div>}
        <div className="score-cards"><div><span>Group</span><strong>{formatScore(own.groupScore)}</strong><small>ส่ง {own.groupAnswered}/{own.groupAssigned} คู่</small></div><div><span>Individual</span><strong>{formatScore(own.individualScore)}</strong><small>ส่ง {own.individualAnswered}/{own.individualAssigned} คู่</small></div><div><span>รวม</span><strong>{formatScore(own.total)}</strong><small>จากคะแนนสูงสุด {assignment.group_max + assignment.individual_max}</small></div></div>
        <Panel title="สถานะการส่งของฉัน"><p>Group: {own.groupSubmitted ? "ส่งแล้ว" : "ยังไม่ส่ง"}</p><p>Individual: {own.individualSubmitted ? "ส่งแล้ว" : "ยังไม่ส่ง"}</p><p>สัดส่วนที่ส่ง p = {own.p.toFixed(3)} · ตัวคูณ M = {own.M.toFixed(3)} · ส่งถึง 90% ได้ตัวคูณเต็ม</p><Status>คะแนนจากคำตอบที่กด Submit ล่าสุดเท่านั้น Draft ไม่ถูกนับ</Status></Panel>
      </>;
    } finally { db.close(); }
  }
  if (section === "extras" && role === "instructor") return <><h1>หน้าจอฟีเจอร์รอง</h1><div className="cards">{["อาจารย์ร่วม", "ส่งคู่ให้ผู้ประเมินเพิ่ม", "อาจารย์ประเมินเอง", "เปลี่ยนกลุ่มและสร้างคู่ใหม่", "Raw Pairs report", "Excel export"].map(name => <Panel key={name} title={name}><Status>ยังไม่เปิดใช้งานใน Demo · P1</Status></Panel>)}</div></>;
  notFound();
}

export default async function DemoPage({ params }: Props) {
  const { role: rawRole, slug = [] } = await params;
  if (rawRole !== "instructor" && rawRole !== "student") notFound();
  const role: Role = rawRole;
  const data = readDemoSnapshot();
  if (!data) return <main className="missing-seed"><h1>ยังไม่มีข้อมูลตัวอย่าง</h1><p>รัน <code>npm run seed</code> แล้วรีเฟรชหน้า</p><Link href="/">กลับหน้าแรก</Link></main>;
  const actor = await currentActor();
  if (!actor || actor.role !== role) redirect("/");
  const defaultClassId = role === "student" ? data.memberships.find(m => m.user_id === actor.id)?.classroom_id ?? "" : "class-feasible";
  const routeAssignmentId = ["assignment", "pairing", "report", "export", "score"].includes(slug[0]) ? slug[1] : slug[0] === "evaluation" ? slug[2] : undefined;
  const routeAssignment = data.assignments.find(a => a.id === routeAssignmentId);
  const requestedClassId = ["classroom", "roster"].includes(slug[0]) ? slug[1] : routeAssignment?.classroom_id;
  const allowedClass = role === "instructor" || data.memberships.some(m => m.user_id === actor.id && m.classroom_id === requestedClassId);
  const classId = requestedClassId && allowedClass ? requestedClassId : defaultClassId;
  const assignmentId = routeAssignment?.classroom_id === classId ? routeAssignment.id : data.assignments.find(a => a.classroom_id === classId)?.id ?? "";
  return <div className="app-shell"><header className="topbar"><Link className="brand" href="/">Pair<span>Eval</span><small>Demo</small></Link><div><span className="pill">{actor.display_name}</span><Link className="switch-link" href="/">เปลี่ยนบทบาท</Link></div></header><div className="app-layout"><Nav role={role} classId={classId} assignmentId={assignmentId} /><main className="content"><div className="day-banner">วันที่ 6 · สร้างห้อง/งาน, จัดคู่, ส่งคำตอบ, ดูคะแนน และ CSV</div><MainContent role={role} slug={slug} data={data} classId={classId} actorId={actor.id} /></main></div></div>;
}
