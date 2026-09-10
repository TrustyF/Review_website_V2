import { cookies } from "next/headers";
import { cache } from "react";
import { auth } from "@/auth";

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isLocale(value: string | null | undefined): value is Locale {
	return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Cookie wins over the session, since session.user.preferredLanguage (JWT-backed,
// see auth.ts) only refreshes at sign-in — account/onboarding actions set it too.
export const getLocale = cache(async (): Promise<Locale> => {
	const cookieLocale = (await cookies()).get("locale")?.value;
	if (isLocale(cookieLocale)) return cookieLocale;

	const session = await auth();
	if (isLocale(session?.user?.preferredLanguage)) {
		return session.user.preferredLanguage;
	}

	return "en";
});
