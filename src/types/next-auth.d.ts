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

// Must augment "@auth/core/jwt" directly, not "next-auth/jwt" — its
// wildcard re-export of JWT doesn't participate in declare-module merging,
// so @auth/core's callbacks would never see members added there.
declare module "@auth/core/jwt" {
	interface JWT {
		id: string;
		role: UserRole;
		preferredLanguage: string;
		newsletterOptIn: boolean;
	}
}
