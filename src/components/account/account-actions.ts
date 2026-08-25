"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { auth } from "@/auth";
import { isValidAvatarSrc } from "@/server/avatars/avatar-catalog";

export type AccountSettingsInput = {
	preferredLanguage: string;
	newsletterOptIn: boolean;
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
