import { describe, expect, it } from "vitest";
import { previewRosterCsv, validateClassroomName } from "../src/lib/classroom-input";
import { validateAssignment } from "../src/lib/assignment-input";

const future = "2030-01-01T00:00:00.000Z";
const validAssignment = {
  classroomId: "demo-class", name: "งานตัวอย่าง", totalScore: 20, groupMax: 15, individualMax: 5,
  groupDeadline: future, individualDeadline: future,
  groupCriteria: [{ name: "คุณภาพ", weightPercent: 60 }, { name: "การนำเสนอ", weightPercent: 40 }],
  individualCriteria: [{ name: "การทำงานร่วมกัน", weightPercent: 100 }],
};

describe("CSV roster validation", () => {
  it("reads BOM, quoted commas and CRLF with accurate row numbers", () => {
    const result = previewRosterCsv('\uFEFFemail,groupname\r\na@demo.invalid,"Team, One"\r\nb@demo.invalid,Team Two\r\n');
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, email: "a@demo.invalid", groupname: "Team, One" },
      { line: 3, email: "b@demo.invalid", groupname: "Team Two" },
    ]);
    expect(result.groups).toEqual(["Team, One", "Team Two"]);
  });
  it("rejects duplicate addresses without usable rows", () => {
    const result = previewRosterCsv("email,groupname\nA@demo.invalid,Orion\na@demo.invalid,Nova");
    expect(result.rows).toEqual([]);
    expect(result.errors.join(" ")).toContain("แถว 3");
  });
  it("rejects malformed and real-address CSV", () => {
    expect(previewRosterCsv("groupname,email\nOrion,a@demo.invalid").errors[0]).toContain("หัวตาราง");
    expect(previewRosterCsv("email,groupname\na@example.com,Orion").errors[0]).toContain(".invalid");
    expect(previewRosterCsv('email,groupname\n"a@demo.invalid,Orion').errors[0]).toContain("ไม่ปิด");
  });
  it("requires a valid classroom name", () => {
    expect(validateClassroomName("A")).not.toBeNull();
    expect(validateClassroomName("ห้องตัวอย่าง")).toBeNull();
  });
});

describe("Assignment validation", () => {
  it("accepts score split and criteria totaling 100% in each section", () => {
    expect(validateAssignment(validAssignment, Date.parse("2026-09-28T00:00:00Z")).errors).toEqual([]);
  });
  it("rejects a mismatch between total and component scores", () => {
    expect(validateAssignment({ ...validAssignment, totalScore: 21 }, 0).errors.join(" ")).toContain("Group + Individual");
  });
  it("rejects incomplete criterion weights", () => {
    const bad = { ...validAssignment, groupCriteria: [{ name: "คุณภาพ", weightPercent: 90 }] };
    expect(validateAssignment(bad, 0).errors.join(" ")).toContain("100%");
  });
  it("rejects past deadlines and duplicate criterion names", () => {
    const bad = { ...validAssignment, groupDeadline: "2020-01-01", groupCriteria: [{ name: "A", weightPercent: 50 }, { name: "a", weightPercent: 50 }] };
    const errors = validateAssignment(bad, Date.parse("2026-09-28T00:00:00Z")).errors.join(" ");
    expect(errors).toContain("อนาคต");
    expect(errors).toContain("ซ้ำ");
  });
});
