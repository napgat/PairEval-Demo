import { describe, expect, it } from "vitest";
import { notificationContent } from "./full-system-notifications";

describe("in-app notification content", () => {
  const room = "11111111-1111-4111-8111-111111111111";
  const assignment = "22222222-2222-4222-8222-222222222222";
  it("has scoped deep links and no score or recipient identity", () => {
    for (const event of ["ASSIGNMENT_PUBLISHED", "PAIRS_REGENERATED", "DEADLINE_48H_GROUP",
      "DEADLINE_48H_INDIVIDUAL", "SCORE_FINALIZED", "EXTRA_EVALUATOR"] as const) {
      const notice = notificationContent(event, room, assignment);
      expect(notice.deepLink).toMatch(/^\/full-system\//);
      expect(notice.message).not.toMatch(/@|\d+[.]\d+|คะแนน/);
      expect(notice.message.length).toBeLessThanOrEqual(200);
    }
    expect(notificationContent("SCORE_FINALIZED", room, assignment).deepLink)
      .toBe(`/full-system/assignments/${assignment}/my-score`);
  });
});
