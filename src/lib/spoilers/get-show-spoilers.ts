import { cookies } from "next/headers";
import { cache } from "react";
import { auth } from "@/auth";

export const SHOW_SPOILERS_COOKIE = "showSpoilers";

// Same precedence as getLocale: the cookie (set by updateAccountSettings) wins, since
// session.user.showSpoilers is JWT-backed and only refreshes at sign-in.
export const getShowSpoilers = cache(async (): Promise<boolean> => {
	const cookie = (await cookies()).get(SHOW_SPOILERS_COOKIE)?.value;
	if (cookie === "1") return true;
	if (cookie === "0") return false;
	return (await auth())?.user?.showSpoilers ?? false;
});
