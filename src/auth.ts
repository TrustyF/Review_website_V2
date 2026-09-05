import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/server/db/client";
import { comparePassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: PrismaAdapter(db),
	// Credentials requires JWT session strategy (all-or-nothing).
	session: { strategy: "jwt" },
	// newUser only fires for new Google sign-ins; Credentials/returning users skip redirect.
	pages: { signIn: "/login", newUser: "/onboarding" },
	providers: [
		// Email verified by Google; allows linking without OAuthAccountNotLinked error
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
		// `user` set only on sign-in request; role/settings changes take effect on next sign-in. Everything reads from JWT, not per-request DB (avatar exception: RootLayout reads DB, revalidatePath refreshes).
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
