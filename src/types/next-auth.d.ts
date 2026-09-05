import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Adds custom User columns to Auth.js's default types so they flow through
// session()/jwt() callbacks without `as` casts at every call site.
declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			role: UserRole;
			preferredLanguage: string;
			newsletterOptIn: boolean;
		} & DefaultSession["user"];
	}

	interface User {
		role: UserRole;
		preferredLanguage: string;
		newsletterOptIn: boolean;
	}
}

// Augment "@auth/core/jwt" directly (next-auth/jwt's re-export doesn't participate in merging)
declare module "@auth/core/jwt" {
	interface JWT {
		id: string;
		role: UserRole;
		preferredLanguage: string;
		newsletterOptIn: boolean;
	}
}
