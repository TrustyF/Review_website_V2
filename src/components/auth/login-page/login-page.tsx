"use client";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/components/ui/link";
import styles from "./login-page.module.sass";

export function LoginPage() {
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") || "/";

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);

		const result = await signIn("credentials", {
			email,
			password,
			redirect: false,
		});
		if (result?.error) {
			setError("Invalid email or password");
			setIsSubmitting(false);
			return;
		}

		// Hard navigation ensures Router Cache busts before new state;
		// router.push can race with useSession() re-render.
		window.location.href = callbackUrl;
	}

	return (
		<div className={styles.wrapper}>
			<h1>Sign in</h1>
			<button
				type="button"
				className={styles.google_button}
				onClick={() => signIn("google", { callbackUrl })}>
				Sign in with Google
			</button>
			<div className={styles.divider}>or</div>
			<form className={styles.form} onSubmit={handleSubmit}>
				<label className={styles.field}>
					Email
					<input
						className={styles.input}
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						autoFocus
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
					/>
				</label>
				{error && <div className={styles.error}>{error}</div>}
				<button
					type="submit"
					className={styles.submit_button}
					disabled={isSubmitting}>
					{isSubmitting ? "Signing in…" : "Sign in"}
				</button>
			</form>
			<Link href="/signup" className={styles.switch_link}>
				Need an account? Sign up
			</Link>
		</div>
	);
}
