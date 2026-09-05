"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

// Manual revalidation for DB edits outside any server action (psql, Prisma
// Studio, a script) — could've touched anything, so wipe the whole site.
export async function forceRevalidateAll(): Promise<void> {
	await requireAdmin();
	revalidatePath("/", "layout");
}
