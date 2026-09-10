"use client";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { Link } from "@/components/ui/link";
import { signUp } from "@/components/auth/auth-actions";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./signup-page.module.sass";

export function SignupPage() {
	const dict = useDictionary();
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
			// Signs in immediately (see auth-actions.ts's note) so they don't bounce to /login.
			await signIn("credentials", { email, password, redirect: false });
			// Hard navigation, not router.push/refresh — see login-page.tsx's comment.
			window.location.href = "/onboarding";
		} catch (err) {
			setError(err instanceof Error ? err.message : dict.auth.signupFailed);
			setIsSubmitting(false);
		}
	}

	return (
		<div className={styles.wrapper}>
			<h1>{dict.auth.createAccountTitle}</h1>
			<form className={styles.form} onSubmit={handleSubmit}>
				<label className={styles.field}>
					{dict.auth.name}
					<input
						className={styles.input}
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoFocus
					/>
				</label>
				<label className={styles.field}>
					{dict.auth.email}
					<input
						className={styles.input}
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</label>
				<label className={styles.field}>
					{dict.auth.password}
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
					{isSubmitting ? dict.auth.creatingAccount : dict.auth.createAccountButton}
				</button>
			</form>
			<Link href="/login" className={styles.switch_link}>
				{dict.auth.haveAccount}
			</Link>
		</div>
	);
}
