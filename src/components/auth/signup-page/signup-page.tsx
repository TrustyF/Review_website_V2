"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { signUp } from "@/components/auth/auth-actions";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import styles from "./signup-page.module.sass";

export function SignupPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [preferredLanguage, setPreferredLanguage] = useState<string>(
		LANGUAGE_OPTIONS[0].value,
	);
	const [newsletterOptIn, setNewsletterOptIn] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);
		try {
			await signUp({ name, email, password, preferredLanguage, newsletterOptIn });
			// Signs the browser in immediately (client-side, see auth-actions.ts's
			// own note on why) so the caller lands signed in instead of bouncing
			// to /login to re-enter the password they just typed.
			await signIn("credentials", { email, password, redirect: false });
			router.push("/");
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to sign up. Try again.");
			setIsSubmitting(false);
		}
	}

	return (
		<div className={styles.wrapper}>
			<h1>Create an account</h1>
			<form className={styles.form} onSubmit={handleSubmit}>
				<label className={styles.field}>
					Name
					<input
						className={styles.input}
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoFocus
					/>
				</label>
				<label className={styles.field}>
					Email
					<input
						className={styles.input}
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</label>
				<label className={styles.field}>
					Password
					<input
						className={styles.input}
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						minLength={8}
					/>
				</label>
				<label className={styles.field}>
					Preferred language
					<select
						className={styles.input}
						value={preferredLanguage}
						onChange={(e) => setPreferredLanguage(e.target.value)}>
						{LANGUAGE_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<label className={styles.checkbox_field}>
					<input
						type="checkbox"
						checked={newsletterOptIn}
						onChange={(e) => setNewsletterOptIn(e.target.checked)}
					/>
					Subscribe to the newsletter
				</label>
				{error && <div className={styles.error}>{error}</div>}
				<button
					type="submit"
					className={styles.submit_button}
					disabled={isSubmitting}>
					{isSubmitting ? "Creating account…" : "Create account"}
				</button>
			</form>
			<Link href="/login" className={styles.switch_link}>
				Already have an account? Sign in
			</Link>
		</div>
	);
}
