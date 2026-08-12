import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/server/db/client";
import { comparePassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: PrismaAdapter(db),
	// Credentials only works against a JWT-backed session, not a database
	// one — this applies to every provider here, Google included, since
	// Auth.js sessions are all-or-nothing per app.
	session: { strategy: "jwt" },
	pages: { signIn: "/login" },
	providers: [
		// Google verifies the email itself, so a password-based signup and a
		// later Google sign-in on the same address are trusted to be the same
		// person rather than bounced with OAuthAccountNotLinked — reasonable
		// for a small, trusted-circle site.
		Google({ allowDangerousEmailAccountLinking: true }),
		Credentials({
			credentials: {
				email: {},
				password: {},
			},
			authorize: async (credentials) => {
				const email =
					typeof credentials?.email === "string" ? credentials.email : undefined;
				const password =
					typeof credentials?.password === "string"
						? credentials.password
						: undefined;
				if (!email || !password) return null;

				const user = await db.user.findUnique({ where: { email } });
				// No passwordHash means this account only has a Google login —
				// nothing to compare against here.
				if (!user?.passwordHash) return null;

				const valid = await comparePassword(password, user.passwordHash);
				if (!valid) return null;

				return {
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image,
					role: user.role,
					preferredLanguage: user.preferredLanguage,
					newsletterOptIn: user.newsletterOptIn,
				};
			},
		}),
	],
	callbacks: {
		// `user` is only set on the request that actually signs in — a role
		// change (promote-admin.ts) or an account-settings edit only takes
		// effect on this token once that happens again, i.e. sign out/in.
		// Deliberate: everything reads from the JWT, not a per-request DB
		// lookup.
		jwt({ token, user }) {
			if (user) {
				token.id = user.id as string;
				token.role = user.role;
				token.preferredLanguage = user.preferredLanguage;
				token.newsletterOptIn = user.newsletterOptIn;
			}
			return token;
		},
		session({ session, token }) {
			session.user.id = token.id;
			session.user.role = token.role;
			session.user.preferredLanguage = token.preferredLanguage;
			session.user.newsletterOptIn = token.newsletterOptIn;
			return session;
		},
	},
});
