"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { auth } from "@/auth";
import { isValidAvatarSrc } from "@/server/avatars/avatar-catalog";
import { comparePassword } from "@/lib/password";

export type AccountSettingsInput = {
	preferredLanguage: string;
	newsletterOptIn: boolean;
	listAddEmailOptIn: boolean;
	// null clears the override, falling back to `name`.
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
			listAddEmailOptIn: input.listAddEmailOptIn,
			username: input.username,
		},
	});

	revalidatePath("/account");
}

export async function updateAvatar(avatarSrc: string): Promise<void> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");
	// Guards against a crafted request writing an arbitrary URL into User.image.
	if (!isValidAvatarSrc(avatarSrc)) throw new Error("Invalid avatar");

	await db.user.update({
		where: { id: session.user.id },
		data: { image: avatarSrc },
	});

	revalidatePath("/account");
}

// Fetched once per page load for the navbar's avatar copy rather than read off
// the session, since the session only refreshes at sign-in.
export async function getMyAvatar(): Promise<string | null> {
	const session = await auth();
	if (!session?.user?.id) return null;

	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { image: true },
	});
	return user?.image ?? null;
}

// Deletes the row outright — related tables cascade off User.id, so nothing
// is orphaned. Caller signs the browser out right after, since this doesn't
// revoke the JWT session cookie itself.
// Feature-disabled for now; guarded here too since a Server Action stays
// reachable regardless of whether any client component calls it.
const ACCOUNT_DELETION_ENABLED = false;

export async function deleteAccount(password: string | null): Promise<void> {
	if (!ACCOUNT_DELETION_ENABLED) throw new Error("Account deletion is disabled");

	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");

	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { passwordHash: true },
	});
	if (!user) throw new Error("Not signed in");

	// OAuth-only accounts have no password; the confirmation phrase is their only gate.
	if (user.passwordHash) {
		if (!password || !(await comparePassword(password, user.passwordHash))) {
			throw new Error("Incorrect password");
		}
	}

	await db.user.delete({ where: { id: session.user.id } });
}
