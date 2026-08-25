"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { auth } from "@/auth";
import { isValidAvatarSrc } from "@/server/avatars/avatar-catalog";
import { comparePassword } from "@/lib/password";

export type AccountSettingsInput = {
	preferredLanguage: string;
	newsletterOptIn: boolean;
	// null clears the override, falling back to `name` — see
	// src/lib/display-name.ts.
	username: string | null;
};

export async function updateAccountSettings(
	input: AccountSettingsInput,
): Promise<void> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");

	await db.user.update({
		where: { id: session.user.id },
		data: {
			preferredLanguage: input.preferredLanguage,
			newsletterOptIn: input.newsletterOptIn,
			username: input.username,
		},
	});

	revalidatePath("/account");
}

export async function updateAvatar(avatarSrc: string): Promise<void> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");
	// Only files actually present under public/avatars are ever offered
	// client-side — this guards against a crafted request writing an
	// arbitrary URL into User.image.
	if (!isValidAvatarSrc(avatarSrc)) throw new Error("Invalid avatar");

	await db.user.update({
		where: { id: session.user.id },
		data: { image: avatarSrc },
	});

	revalidatePath("/account");
}

// The navbar's own copy of the avatar (see avatar-context.tsx) is fetched
// through this once per page load rather than read off the session, which
// only refreshes at sign-in (see auth.ts's own comment) — a plain read, so
// no revalidation story needed; AvatarPicker updates the context directly
// after a pick instead of re-calling this.
export async function getMyAvatar(): Promise<string | null> {
	const session = await auth();
	if (!session?.user?.id) return null;

	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { image: true },
	});
	return user?.image ?? null;
}

// Deletes the row outright rather than soft-deleting — Account/Session/
// WatchlistItem/List.targetUser all cascade off User.id (see user.prisma),
// so nothing is left orphaned. The caller (delete-account-section.tsx) signs
// the browser out right after this resolves, since the JWT session cookie
// otherwise stays "valid" (nothing here revokes it) until it naturally
// expires or the user signs out.
export async function deleteAccount(password: string | null): Promise<void> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");

	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { passwordHash: true },
	});
	if (!user) throw new Error("Not signed in");

	// OAuth-only accounts (no passwordHash) have nothing to check a password
	// against — the confirmation-phrase step in the UI is their only gate.
	if (user.passwordHash) {
		if (!password || !(await comparePassword(password, user.passwordHash))) {
			throw new Error("Incorrect password");
		}
	}

	await db.user.delete({ where: { id: session.user.id } });
}
