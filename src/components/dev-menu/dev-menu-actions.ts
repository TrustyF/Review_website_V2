"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

// For after a manual DB edit (psql, Prisma Studio, a one-off script, ...) —
// none of those go through a server action, so nothing calls revalidatePath
// on their behalf, and every statically-rendered list page (see
// media-add-actions.ts's own comment on this exact "/" + "layout" call)
// keeps serving whatever it last rendered until something else happens to
// revalidate it. This is that "something else", triggered by hand instead
// of by a mutation.
export async function forceRevalidateAll(): Promise<void> {
	await requireAdmin();
	revalidatePath("/", "layout");
}
