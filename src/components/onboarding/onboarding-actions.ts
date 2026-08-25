"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { auth } from "@/auth";

// Saved per-step rather than as one final submit, so a user who abandons the
// wizard partway (or hits "Skip" on a later step) still keeps whatever
// earlier steps they did complete.

export async function saveOnboardingUsername(username: string | null): Promise<void> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");

	await db.user.update({
		where: { id: session.user.id },
		data: { username },
	});

	revalidatePath("/account");
}

export type OnboardingPreferences = {
	preferredLanguage: string;
	newsletterOptIn: boolean;
};

export async function saveOnboardingPreferences(
	input: OnboardingPreferences,
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
