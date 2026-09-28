import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readDemoSnapshot, type DemoSnapshot } from "@/lib/demo-data";
import { currentActor } from "@/lib/demo-session";
import ClassroomForm from "../../components/classroom-form";
import AssignmentForm from "../../components/assignment-form";

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
    ["งานประเมิน", href(role, "assignment", assignmentId)],
    ["สร้างคู่", href(role, "pairing", assignmentId)],
    ["รายงาน", href(role, "report", assignmentId)],
    ["ส่งออก CSV", href(role, "export", assignmentId)],
    ["ฟีเจอร์รอง", href(role, "extras")],
  ] : [
    ["ห้องเรียน", href(role)],
    ["รายละเอียดห้อง", href(role, "classroom", classId)],
    ["งานประเมิน", href(role, "assignment", assignmentId)],
    ["ประเมินกลุ่ม", href(role, "evaluation", "group", assignmentId)],
    ["ประเมินบุคคล", href(role, "evaluation", "individual", assignmentId)],
    ["คะแนนของฉัน", href(role, "score", assignmentId)],
  ];
  return <nav className="sidebar" aria-label="หน้าจอสาธิต"><p className="nav-label">หน้าจอหลัก</p>{items.map(([label, url]) => <Link key={url} href={url}>{label}<span>↗</span></Link>)}</nav>;
}

function MainContent({ role, slug, data, classId, actorId }: { role: Role; slug: string[]; data: DemoSnapshot; classId: string; actorId: string }) {
  const [section, id, maybeAssignment] = slug;
  const classroom = data.classrooms.find(c => c.id === (section === "classroom" || section === "roster" ? id : classId));
  const assignment = data.assignments.find(a => a.id === (section === "assignment" || section === "pairing" || section === "report" || section === "export" || section === "score" ? id : maybeAssignment));
  const studentId = actorId;

  if (section === "classrooms" && id === "new" && role === "instructor") return <><h1>สร้างห้องเรียน</h1><p className="intro">นำเข้า CSV หลังตรวจตัวอย่าง ทุกแถวจะบันทึกพร้อมกันเมื่อข้อมูลถูกต้องทั้งหมด</p><ClassroomForm /></>;
  if (section === "assignments" && id === "new" && role === "instructor") {
    const targetClassroom = data.classrooms.find(c => c.id === maybeAssignment);
    if (!targetClassroom) notFound();
    return <><h1>สร้างงานประเมิน</h1><p className="intro">ระบุคะแนนรวม เกณฑ์ของ Group/Individual และกำหนดส่ง</p><AssignmentForm classroomId={targetClassroom.id} classroomName={targetClassroom.name} /></>;
  }

  if (!section) {
    const visible = role === "instructor" ? data.classrooms : data.classrooms.filter(c => data.memberships.some(m => m.classroom_id === c.id && m.user_id === studentId));
    return <><h1>ห้องเรียน</h1><p className="intro">{role === "instructor" ? "รายการห้องที่ผู้สอนตัวอย่างดูแล" : "ห้องของนักศึกษาตัวอย่าง 01"}</p>{role === "instructor" && <Link className="primary-button inline-button" href={href(role, "classrooms", "new")}>+ สร้างห้องและนำเข้า CSV</Link>}<div className="cards">{visible.map(c => <Link className="card-link" key={c.id} href={href(role, "classroom", c.id)}><span className="eyebrow">{c.demo_case === "feasible" ? "ชุดข้อมูลจัดคู่ได้" : c.demo_case === "infeasible" ? "กรณีจัดคู่ไม่ได้" : "ห้องที่สร้างใหม่"}</span><strong>{c.name}</strong><small>{data.groups.filter(g => g.classroom_id === c.id).length} กลุ่ม · {data.memberships.filter(m => m.classroom_id === c.id).length} นักศึกษา</small></Link>)}</div></>;
  }
  if (section === "classroom" && classroom && (role === "instructor" || classroom.id === classId)) {
    const thisAssignments = data.assignments.filter(a => a.classroom_id === classroom.id);
    const ownMembership = data.memberships.find(m => m.classroom_id === classroom.id && m.user_id === studentId);
    return <><h1>{classroom.name}</h1><p className="intro">{classroom.demo_case === "feasible" ? "3 กลุ่ม กลุ่มละ 7 คน เป็นชุดตัวอย่างสำหรับตรวจ feasibility ของทั้ง Group และ Individual" : classroom.demo_case === "infeasible" ? "2 กลุ่ม กลุ่มละ 2 คน เป็นกรณีที่ต้องอธิบายว่าไม่สามารถจัดคู่ตามกติกาได้" : "ห้องที่นำเข้าด้วย CSV"}</p><div className="cards"><Panel title="สมาชิก"><p>{data.memberships.filter(m => m.classroom_id === classroom.id).length} คนใน {data.groups.filter(g => g.classroom_id === classroom.id).length} กลุ่ม</p>{role === "instructor" ? <Link className="text-link" href={href(role, "roster", classroom.id)}>ดูรายชื่อและกลุ่ม →</Link> : <p>กลุ่มของคุณ: {data.groups.find(g => g.id === ownMembership?.group_id)?.name}</p>}</Panel><Panel title="งานประเมิน">{thisAssignments.length ? thisAssignments.map(item => <p key={item.id}><Link className="text-link" href={href(role, "assignment", item.id)}>{item.name} →</Link></p>) : <p>ยังไม่มีงานประเมิน</p>}{role === "instructor" && <Link className="primary-button inline-button" href={href(role, "assignments", "new", classroom.id)}>+ สร้างงาน</Link>}</Panel></div></>;
  }
  if (section === "roster" && role === "instructor" && classroom) {
    return <><h1>รายชื่อและกลุ่ม</h1><p className="intro">{classroom.name} · ข้อมูลสังเคราะห์</p><div className="cards">{data.groups.filter(g => g.classroom_id === classroom.id).map(g => <Panel key={g.id} title={g.name}><ul className="plain-list">{data.memberships.filter(m => m.group_id === g.id).map(m => { const user = data.users.find(u => u.id === m.user_id); return <li key={m.user_id}>{user?.display_name} <small>{user?.email}</small></li>; })}</ul></Panel>)}</div></>;
  }
  if (section === "assignment" && assignment && (role === "instructor" || assignment.classroom_id === classId)) {
    const criteria = data.criteria.filter(c => c.assignment_id === assignment.id);
    return <><h1>{assignment.name}</h1><p className="intro">คะแนนรวม {assignment.group_max + assignment.individual_max} · Group {assignment.group_max} · Individual {assignment.individual_max}</p><div className="cards"><Panel title="เกณฑ์กลุ่ม">{criteria.filter(c => c.kind === "group").map(c => <p key={c.id}>{c.name} <strong>{c.weight_percent}%</strong></p>)}</Panel><Panel title="เกณฑ์บุคคล">{criteria.filter(c => c.kind === "individual").map(c => <p key={c.id}>{c.name} <strong>{c.weight_percent}%</strong></p>)}</Panel></div><Panel title="กำหนดส่ง"><p>Group: {new Date(assignment.group_deadline).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p><p>Individual: {new Date(assignment.individual_deadline).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p></Panel><Status>คู่ประเมินจะพร้อมหลังสร้างคู่ในวันที่ 3</Status></>;
  }
  if (section === "pairing" && role === "instructor" && assignment) {
    const isFeasibleSample = assignment.classroom_id === "class-feasible";
    return <><h1>สร้างคู่และตรวจความเป็นไปได้</h1><p className="intro">{assignment.name}</p><Panel title="สถานะคู่ประเมิน"><p>จำนวนคู่ที่บันทึก: <strong>{data.pairCount}</strong></p><p>เป้าหมาย coverage: 5 ผลต่อคู่</p><Status>{isFeasibleSample ? "ชุดข้อมูลนี้เตรียมไว้สำหรับทดสอบการจัดคู่ในวันที่ 3; ยังไม่ได้คำนวณ coverage" : assignment.classroom_id === "class-infeasible" ? "2 กลุ่ม: ไม่มีผู้ประเมิน Group ที่ไม่อยู่ในสองกลุ่มนี้ จึงไม่สามารถจัดคู่ได้" : "ห้องที่สร้างใหม่ยังไม่ได้ตรวจ feasibility; จะตรวจจากสมาชิกและกลุ่มจริงในวันที่ 3"}</Status></Panel></>;
  }
  if (section === "report" && role === "instructor" && assignment) return <><h1>รายงานผู้สอน</h1><p className="intro">{assignment.name}</p><Panel title="คะแนนและ coverage"><p>ยังไม่มี submission หรือผลคะแนน</p><Status>จะเชื่อมผลคะแนนจากคำตอบจริงในวันที่ 5</Status></Panel></>;
  if (section === "export" && role === "instructor" && assignment) return <><h1>ส่งออกคะแนน</h1><Panel title="CSV summary"><p>ยังไม่มีคะแนนสำหรับส่งออก</p><Status>ฟังก์ชันดาวน์โหลด CSV จะทำในวันที่ 5</Status></Panel></>;
  if (section === "evaluation" && role === "student" && ["group", "individual"].includes(id) && assignment?.classroom_id === classId) return <><h1>{id === "group" ? "ประเมินกลุ่ม" : "ประเมินบุคคล"}</h1><p className="intro">{assignment.name} · นักศึกษาตัวอย่าง 01</p><Panel title="คู่ของฉัน"><p>ยังไม่มีคู่ที่ได้รับมอบหมาย</p><Status>การเลือก 1–6, Save, Submit และ Re-submit จะเริ่มทำหลังสร้างคู่ในวันที่ 3</Status></Panel></>;
  if (section === "score" && role === "student" && assignment?.classroom_id === classId) return <><h1>คะแนนของฉัน</h1><Panel title="นักศึกษาตัวอย่าง 01"><p>ยังไม่มีคะแนนจาก submission</p><Status>คะแนนชั่วคราวและคะแนนสุดท้ายจะคำนวณจากคำตอบจริงในวันที่ 5</Status></Panel></>;
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
  const classId = role === "student" ? data.memberships.find(m => m.user_id === actor.id)?.classroom_id ?? "" : "class-feasible";
  const assignmentId = data.assignments.find(a => a.classroom_id === classId)?.id ?? "";
  return <div className="app-shell"><header className="topbar"><Link className="brand" href="/">Pair<span>Eval</span><small>Demo</small></Link><div><span className="pill">{actor.display_name}</span><Link className="switch-link" href="/">เปลี่ยนบทบาท</Link></div></header><div className="app-layout"><Nav role={role} classId={classId} assignmentId={assignmentId} /><main className="content"><div className="day-banner">วันที่ 2 · สร้างห้อง/งานได้จากข้อมูลสังเคราะห์ · จับคู่และคะแนนจะทำในวันถัดไป</div><MainContent role={role} slug={slug} data={data} classId={classId} actorId={actor.id} /></main></div></div>;
}
