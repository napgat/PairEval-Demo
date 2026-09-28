import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type DemoUser = { id: string; email: string; display_name: string; role: "instructor" | "student" };
export type DemoClassroom = { id: string; name: string; demo_case: string };
export type DemoGroup = { id: string; classroom_id: string; name: string };
export type DemoMembership = { classroom_id: string; group_id: string; user_id: string };
export type DemoAssignment = {
  id: string; classroom_id: string; name: string; group_max: number; individual_max: number;
  group_deadline: string; individual_deadline: string;
};
export type DemoCriterion = { id: string; assignment_id: string; kind: "group" | "individual"; name: string; weight_percent: number };
export type DemoSnapshot = {
  users: DemoUser[]; classrooms: DemoClassroom[]; groups: DemoGroup[];
  memberships: DemoMembership[]; assignments: DemoAssignment[]; criteria: DemoCriterion[];
  pairCount: number;
};

export type DemoActor = { id: string; role: "instructor" | "student"; display_name: string };

export function openDemoDb(options: { readOnly?: boolean } = {}): DatabaseSync {
  const path = join(process.cwd(), "data", "demo.sqlite");
  if (!existsSync(path)) throw new Error("Demo database is missing. Run npm run seed.");
  const db = new DatabaseSync(path, options);
  if (!options.readOnly) db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export function actorForToken(token: string | undefined): DemoActor | null {
  if (!token) return null;
  const db = openDemoDb({ readOnly: true });
  try {
    return (db.prepare("SELECT users.id, users.role, users.display_name FROM demo_sessions JOIN users ON users.id = demo_sessions.user_id WHERE demo_sessions.token = ?").get(token) as DemoActor | undefined) ?? null;
  } finally { db.close(); }
}

export function readDemoSnapshot(): DemoSnapshot | null {
  const path = join(process.cwd(), "data", "demo.sqlite");
  if (!existsSync(path)) return null;
  const db = openDemoDb({ readOnly: true });
  try {
    return {
      users: db.prepare("SELECT * FROM users ORDER BY id").all() as DemoUser[],
      classrooms: db.prepare("SELECT * FROM classrooms ORDER BY id DESC").all() as DemoClassroom[],
      groups: db.prepare("SELECT * FROM groups ORDER BY classroom_id, name").all() as DemoGroup[],
      memberships: db.prepare("SELECT * FROM memberships ORDER BY user_id").all() as DemoMembership[],
      assignments: db.prepare("SELECT * FROM assignments ORDER BY classroom_id").all() as DemoAssignment[],
      criteria: db.prepare("SELECT * FROM criteria ORDER BY id").all() as DemoCriterion[],
      pairCount: (db.prepare("SELECT COUNT(*) AS count FROM pair_assignments").get() as { count: number }).count,
    };
  } finally {
    db.close();
  }
}
