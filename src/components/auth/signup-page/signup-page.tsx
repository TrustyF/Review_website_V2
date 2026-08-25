"use client";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { signUp } from "@/components/auth/auth-actions";
import styles from "./signup-page.module.sass";

export function SignupPage() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);
		try {
			await signUp({ name, email, password });
			// Signs the browser in immediately (client-side, see auth-actions.ts's
			// own note on why) so the caller lands signed in instead of bouncing
			// to /login to re-enter the password they just typed.
			await signIn("credentials", { email, password, redirect: false });
			// Hard navigation, not router.push + router.refresh — see
			// login-page.tsx's own comment on why. Lands on the onboarding
			// wizard (username/avatar/language/newsletter) instead of home.
			window.location.href = "/onboarding";
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
