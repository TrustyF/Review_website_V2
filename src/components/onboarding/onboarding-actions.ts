"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/server/db/client";
import { auth } from "@/auth";
import { isLocale } from "@/lib/i18n/get-locale";

// Saved per-step so incomplete wizard sessions retain earlier progress

export async function saveOnboardingLanguage(preferredLanguage: string): Promise<void> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");

	await db.user.update({
		where: { id: session.user.id },
		data: { preferredLanguage },
	});

	// See updateAccountSettings — the cookie is what makes the rest of the wizard
	// switch language immediately, rather than waiting for next sign-in.
	if (isLocale(preferredLanguage)) {
		(await cookies()).set("locale", preferredLanguage, {
			path: "/",
			maxAge: 60 * 60 * 24 * 365,
		});
	}

	revalidatePath("/account");
}

export async function saveOnboardingUsername(username: string | null): Promise<void> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");

	await db.user.update({
		where: { id: session.user.id },
		data: { username },
	});

	revalidatePath("/account");
}

export async function saveOnboardingNewsletterOptIn(
	newsletterOptIn: boolean,
): Promise<void> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");

	await db.user.update({
		where: { id: session.user.id },
		data: { newsletterOptIn },
	});

	revalidatePath("/account");
}
