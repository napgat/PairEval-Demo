import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { planFullSystemPairs } from "./full-system-pairing";
import { queueKey, readQueuedAnswers } from "./evaluation-queue";
import { retentionCutoff, stablePrivacyAlias, redactIdentity } from "./full-system-privacy";
import { validateAssignmentInput } from "./full-system-assignments";
describe("PRD v2.0 regression properties", () => {
  it("INV-1..5: eligibility, uniqueness, balanced coverage, workload and reproduction across generated cohorts", () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 2, max: 8 }), { minLength: 3, maxLength: 8 }),
      fc.integer({ min: 1, max: 10 }), fc.integer({ min: 1, max: 12 }), fc.integer(), (sizes, coverage, cap, seed) => {
        const students = sizes.flatMap((n,g) => Array.from({length:n}, (_,i) => ({id:`s${g}-${i}`,groupId:`g${g}`})));
        const byId = new Map(students.map(s => [s.id,s.groupId]));
        const input = { students, groups: sizes.map((_,g) => `g${g}`), criteria: [{id:"g",side:"GROUP" as const},{id:"i",side:"INDIVIDUAL" as const}], targetCoverage:coverage, maxWorkload:cap, seed:String(seed),groupEnabled:true,individualEnabled:true };
        const result = planFullSystemPairs(input);
        expect(planFullSystemPairs(input)).toEqual(result);
        const keys = result.comparisons.map(p => `${p.criterionId}:${p.aId}:${p.bId}:${p.evaluatorId}`);
        expect(new Set(keys).size).toBe(keys.length);
        for(const p of result.comparisons) {
          expect([p.aId,p.bId]).not.toContain(p.evaluatorId);
          if(p.side==="GROUP") expect([p.aId,p.bId]).not.toContain(byId.get(p.evaluatorId));
          else { expect(byId.get(p.evaluatorId)).toBe(byId.get(p.aId)); expect(byId.get(p.aId)).toBe(byId.get(p.bId)); }
          expect(["A","B"]).toContain(p.displayLeft);
        }
        for(const part of result.parts) {
          const loads=Object.values(part.workload);
          expect(loads.every(v => v<=cap)).toBe(true);
          if(loads.length) expect(Math.max(...loads)-Math.min(...loads)).toBeLessThanOrEqual(1);
          const rows=result.comparisons.filter(p=>p.criterionId===part.criterionId && (!part.groupId||byId.get(p.aId)===part.groupId));
          const counts=new Map<string,number>();
          for(const p of rows)counts.set(`${p.aId}:${p.bId}`,(counts.get(`${p.aId}:${p.bId}`)??0)+1);
          for(const n of counts.values())expect(n).toBe(part.coverage);
          expect(rows.length).toBe(part.pairCount*part.coverage);
        }
      }), {numRuns:100,seed:20261015});
  }, 20000);
  it("never replays another viewer/generation queue, foreign pairs, invalid choices or expired work", () => {
    expect(queueKey("u1","a",1,"GROUP")).not.toBe(queueKey("u2","a",1,"GROUP"));
    expect(queueKey("u1","a",1,"GROUP")).not.toBe(queueKey("u1","a",2,"GROUP"));
    const raw=JSON.stringify({expiresAt:"2030-01-01",answers:[["p",3],["foreign",1],["bad",7]]});
    expect([...readQueuedAnswers(raw,new Set(["p","bad"]),Date.parse("2029-01-01"))]).toEqual([["p",3]]);
    expect(readQueuedAnswers(raw,new Set(["p"]),Date.parse("2031-01-01")).size).toBe(0);
    expect(readQueuedAnswers("corrupt",new Set()).size).toBe(0);
  });
  it("anonymizes strings while preserving score values and stable pseudonyms", () => {
    const alias=stablePrivacyAlias("k".repeat(32),"user");
    expect(alias).toBe(stablePrivacyAlias("k".repeat(32),"user"));
    expect(alias).not.toBe(stablePrivacyAlias("z".repeat(32),"user"));
    expect(redactIdentity({name:"Name",score:12.798,answers:[{choice:2}]},{Name:alias})).toEqual({name:alias,score:12.798,answers:[{choice:2}]});
    expect(retentionCutoff(new Date("2026-10-15"),2).toISOString()).toBe("2025-08-01T00:00:00.000Z");
    expect(retentionCutoff(new Date("2026-07-31"),1).toISOString()).toBe("2025-08-01T00:00:00.000Z");
    expect(retentionCutoff(new Date("2026-08-01"),1).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
  it("validates assignment-specific score bands", () => {
    const base={name:"Band test",groupMaxScore:15,individualMaxScore:0,groupDeadline:"2030-01-01T00:00:00Z",individualDeadline:null,targetCoverage:3,maxWorkload:8,criteria:[]};
    expect(validateAssignmentInput(base)).toMatchObject({scoreFloor:.6,scoreCeiling:1});
    expect(validateAssignmentInput({...base,scoreFloor:.5,scoreCeiling:.95})).toMatchObject({scoreFloor:.5,scoreCeiling:.95});
    for(const [scoreFloor,scoreCeiling] of [[1,1],[-.1,1],[.8,.7],[.6,1.01],[.6001,1]]) expect(()=>validateAssignmentInput({...base,scoreFloor,scoreCeiling})).toThrow();
  });
});
