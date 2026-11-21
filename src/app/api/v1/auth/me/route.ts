import { handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";

export async function GET() {
  return handle(async () => {
    const u = await currentUser();
    return ok({ user: u ? { id: u.id, displayName: u.displayName, role: u.role } : null });
  });
}
