"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/server/db/client";
import { auth } from "@/auth";
import { isLocale } from "@/lib/i18n/get-locale";

// Saved per-step so incomplete wizard sessions retain earlier progress

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

	// See updateAccountSettings — the session JWT won't pick this up until
	// next sign-in, so the cookie is what makes onboarding's choice stick.
	if (isLocale(input.preferredLanguage)) {
		(await cookies()).set("locale", input.preferredLanguage, {
			path: "/",
			maxAge: 60 * 60 * 24 * 365,
		});
	}

	revalidatePath("/account");
}
