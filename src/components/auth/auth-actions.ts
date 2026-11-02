"use server";
import { db } from "@/server/db/client";
import { hashPassword } from "@/lib/password";
import { sendNewAccountAlert } from "@/server/email/send-new-account-alert";

export type SignUpInput = {
	name: string;
	email: string;
	password: string;
};

// Returned, not thrown: production builds mask thrown server action messages.
export type SignUpError =
	| "emailInvalid"
	| "passwordTooShort"
	| "passwordTooLong"
	| "emailTaken";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bcrypt ignores everything past 72 bytes.
const MAX_PASSWORD_BYTES = 72;

// Creates row only; caller must call next-auth/react's signIn() to update session
export async function signUp(
	input: SignUpInput,
): Promise<{ error: SignUpError } | undefined> {
	const email = String(input.email ?? "")
		.trim()
		.toLowerCase();
	const password = String(input.password ?? "");
	if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
		return { error: "emailInvalid" };
	}
	if (password.length < 8) return { error: "passwordTooShort" };
	if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
		return { error: "passwordTooLong" };
	}

	const existing = await db.user.findUnique({ where: { email } });
	if (existing) return { error: "emailTaken" };

	// preferredLanguage/newsletterOptIn/username/image picked in /onboarding wizard after this. Only needs enough to create row and sign in.
	const user = await db.user.create({
		data: {
			email,
			name:
				String(input.name ?? "")
					.trim()
					.slice(0, 100) || null,
			passwordHash: await hashPassword(password),
		},
	});

	// Best-effort — a failed alert email shouldn't fail the signup.
	try {
		await sendNewAccountAlert(user);
	} catch (err) {
		console.error("Failed to send new account alert email", err);
	}
	return undefined;
}
