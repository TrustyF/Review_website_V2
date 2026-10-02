"use client";
import { useState } from "react";

type ErrorMessage = string | ((error: unknown) => string);

// Uses the thrown Error's own message when there is one (e.g. a server action's validation error).
export function errorMessageOr(fallback: string): (error: unknown) => string {
	return (error) => (error instanceof Error ? error.message : fallback);
}

// pending/error state for button-triggered async calls. run() never throws; it resolves false
// on failure. stayPendingOnSuccess suits actions that navigate away once done.
export function useAsyncAction() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function run(
		action: () => Promise<void>,
		errorMessage: ErrorMessage,
		{ stayPendingOnSuccess = false }: { stayPendingOnSuccess?: boolean } = {},
	): Promise<boolean> {
		setPending(true);
		setError(null);
		try {
			await action();
			if (!stayPendingOnSuccess) setPending(false);
			return true;
		} catch (e) {
			setError(
				typeof errorMessage === "string" ? errorMessage : errorMessage(e),
			);
			setPending(false);
			return false;
		}
	}

	return { pending, error, setError, run };
}
