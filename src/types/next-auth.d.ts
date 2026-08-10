import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Auth.js's Session/User/JWT types only carry name/email/image by default —
// this adds the custom User columns (role, preferredLanguage,
// newsletterOptIn) so they flow through session()/jwt() callbacks in
// src/auth.ts without `as` casts at every call site.
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

// "next-auth/jwt" re-exports JWT via `export * from "@auth/core/jwt"` — a
// wildcard re-export, unlike "next-auth"'s named re-export of Session above.
// TypeScript's declare-module merging doesn't reach through a wildcard
// re-export back to the original declaration, so the callback signatures
// inside @auth/core (which import JWT straight from "@auth/core/jwt") never
// see members added by augmenting "next-auth/jwt" — augmenting the source
// module directly is what actually takes effect.
declare module "@auth/core/jwt" {
	interface JWT {
		id: string;
		role: UserRole;
		preferredLanguage: string;
		newsletterOptIn: boolean;
	}
}
