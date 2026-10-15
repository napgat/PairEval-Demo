"use client";
import { use, useCallback, useEffect, useState } from "react";

type Member = {
  id: string;
  displayName: string;
  email: string;
  groupName: string;
  studentId: string | null;
};
type Preview = {
  version: number;
  digest: string;
  diff: { added: number; moved: number; unchanged: number };
  warnings: string[];
};
export default function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [rows, setRows] = useState<Member[]>([]),
    [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const base = `/api/full-system/classrooms/${id}/roster`;
  async function request(url: string, body?: unknown) {
    const r = await fetch(
      url,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const p = await r.json();
    if (r.status === 202)
      throw new Error(
        "บันทึกแล้วและกำลังยืนยัน audit กรุณาโหลดรายชื่อใหม่ก่อนทำรายการซ้ำ",
      );
    if (!r.ok)
      throw new Error(
        p.error?.message ??
          p.errors?.join("; ") ??
          `ไม่สามารถทำรายการได้ (${r.status})`,
      );
    return p.data;
  }
  const load = useCallback(async () => {
    const r = await fetch(base);
    const p = await r.json();
    if (!r.ok) throw new Error("บัญชีนี้ไม่มีสิทธิ์จัดการรายชื่อของห้องนี้");
    setRows(p.data);
  }, [base]);
  useEffect(() => {
    let active = true;
    void fetch(base)
      .then(async (r) => {
        if (!r.ok)
          throw new Error("บัญชีนี้ไม่มีสิทธิ์จัดการรายชื่อของห้องนี้");
        return r.json();
      })
      .then((p) => {
        if (active) setRows(p.data);
      })
      .catch((e) => {
        if (active) {
          setError(true);
          setMessage(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [base]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="fs-page">
      <a className="fs-back-link" href="/full-system">
        ← กลับไปห้องเรียน
      </a>
      <h1>จัดการรายชื่อและกลุ่ม</h1>
      <p>
        ผู้สอนและผู้ช่วยสอนนำเข้ารายชื่อได้ ต้องยกเลิกเผยแพร่งานก่อนเปลี่ยนกลุ่ม
      </p>
      {message && (
        <p
          className={error ? "error-box" : "notice"}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <section className="form-panel">
        <h2>นำเข้า CSV</h2>
        <label className="field">
          CSV รายชื่อ
          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
            }}
            placeholder="email,group_name,student_id,display_name"
          />
        </label>
        <div className="actions">
          <button
            disabled={busy || !csv.trim()}
            onClick={() =>
              action(async () => {
                const p = await request(base + "/preview", { csv });
                if (p.errors?.length) throw new Error(p.errors.join("; "));
                setPreview(p);
              })
            }
          >
            ตรวจข้อมูล
          </button>
          <button
            disabled={busy || !preview}
            onClick={() =>
              action(async () => {
                await request(base + "/import", {
                  csv,
                  expectedVersion: preview!.version,
                  confirmDigest: preview!.digest,
                });
                setPreview(null);
                await load();
                setMessage("นำเข้ารายชื่อแล้ว");
              })
            }
          >
            ยืนยันนำเข้ารายชื่อ
          </button>
        </div>
        {preview && (
          <p role="status">
            เพิ่ม {preview.diff.added} · ย้ายกลุ่ม {preview.diff.moved} · คงเดิม{" "}
            {preview.diff.unchanged} {preview.warnings.join("; ")}
          </p>
        )}
      </section>
      <section className="form-panel">
        <h2>รายชื่อปัจจุบัน ({rows.length} คน)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>อีเมล</th>
                <th>รหัสนักศึกษา</th>
                <th>กลุ่ม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.displayName}</td>
                  <td>{row.email}</td>
                  <td>{row.studentId ?? "—"}</td>
                  <td>{row.groupName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
