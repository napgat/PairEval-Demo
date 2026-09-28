import { cookies } from "next/headers";
import { actorForToken, type DemoActor } from "./demo-data";

export const SESSION_COOKIE = "paireval_demo_session";

export async function currentActor(): Promise<DemoActor | null> {
  const cookieStore = await cookies();
  return actorForToken(cookieStore.get(SESSION_COOKIE)?.value);
}
