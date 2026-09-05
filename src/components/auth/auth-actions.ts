"use server";
import { db } from "@/server/db/client";
import { hashPassword } from "@/lib/password";

export type SignUpInput = {
	name: string;
	email: string;
	password: string;
};

// Creates row only; caller must call next-auth/react's signIn() to update session
export async function signUp(input: SignUpInput): Promise<void> {
	const email = input.email.trim().toLowerCase();
	if (!email) throw new Error("Email is required");
	if (input.password.length < 8) {
		throw new Error("Password must be at least 8 characters");
	}

	const existing = await db.user.findUnique({ where: { email } });
	if (existing) throw new Error("An account with this email already exists");

	// preferredLanguage/newsletterOptIn/username/image picked in /onboarding wizard after this. Only needs enough to create row and sign in.
	await db.user.create({
		data: {
			email,
			name: input.name.trim() || null,
			passwordHash: await hashPassword(input.password),
		},
	});
}
