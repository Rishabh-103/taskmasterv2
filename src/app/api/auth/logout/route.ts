import { clearSessionCookie } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST() {
  const res = json({ success: true });
  clearSessionCookie(res);
  return res;
}
