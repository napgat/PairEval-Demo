import { describe, expect, it } from "vitest";
import { previewFullRosterCsv } from "./full-system-roster";

describe("Full System roster CSV preview", () => {
  it("normalizes only case and surrounding spaces, and preserves quoted commas", () => {
    const result = previewFullRosterCsv(
      'EMAIL,group_name,student_id,display_name\n Somchai.A+X@Uni.ac.th ,G1,101,"Somchai, A"\nother@uni.ac.th,G1,102,Other',
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ email: "somchai.a+x@uni.ac.th", displayName: "Somchai, A" });
    expect(result.groups).toEqual(["G1"]);
  });

  it("rejects duplicate normalized email and student id before import", () => {
    const result = previewFullRosterCsv("email,group_name,student_id\nA@uni.ac.th,G1,1\na@uni.ac.th,G2,1");
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(expect.arrayContaining(["row 3: duplicate email", "row 3: duplicate student_id"]));
  });

  it("rejects malformed quotes and missing students", () => {
    expect(previewFullRosterCsv('email,group_name\n"unclosed,G1').errors).toContain("row 2: unclosed quote");
    expect(previewFullRosterCsv("email,group_name").errors).toContain("CSV has no students");
  });
});
