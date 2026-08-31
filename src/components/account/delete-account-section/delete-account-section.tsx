"use client";
import { useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { X } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import { useOutsideClick } from "@/lib/use-outside-click";
import { deleteAccount } from "@/components/account/account-actions";
import styles from "./delete-account-section.module.sass";

const CONFIRM_PHRASE = "DELETE";

type Props = {
	// OAuth-only accounts have no password, so they skip straight to the confirmation-phrase gate.
	hasPassword: boolean;
};

export function DeleteAccountSection({ hasPassword }: Props) {
	const [isOpen, setIsOpen] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	useOutsideClick(panelRef, () => setIsOpen(false), {
		enabled: isOpen && !isSubmitting,
		escapeToo: true,
	});

	const canSubmit = confirmText === CONFIRM_PHRASE && (!hasPassword || password.length > 0);

	function openModal() {
		setConfirmText("");
		setPassword("");
		setError(null);
		setIsOpen(true);
	}

	async function handleDelete() {
		if (!canSubmit || isSubmitting) return;
		setIsSubmitting(true);
		setError(null);
		try {
			await deleteAccount(hasPassword ? password : null);
			await signOut({ callbackUrl: "/" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete account.");
			setIsSubmitting(false);
		}
	}

	return (
		<div className={styles.wrapper}>
			<h2 className={styles.title}>Danger zone</h2>
			<p className={styles.subtitle}>
				Permanently delete your account, watchlist, and lists. This can&apos;t
				be undone.
			</p>
			<Clickable className={styles.delete_button} onClick={openModal}>
				Delete account
			</Clickable>

			{isOpen && (
				<div className={styles.modal_backdrop}>
					<div className={styles.modal_panel} ref={panelRef}>
						<div className={styles.modal_header}>
							<span>Delete account</span>
							<Clickable
								className={styles.close_button}
								aria-label="Close"
								disabled={isSubmitting}
								onClick={() => setIsOpen(false)}>
								<X size={16} />
							</Clickable>
						</div>
						<p className={styles.warning}>
							This permanently deletes your account, watchlist, and lists.
							There is no undo.
						</p>
						<label className={styles.field}>
							Type {CONFIRM_PHRASE} to confirm
							<input
								className={styles.input}
								type="text"
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								autoFocus
							/>
						</label>
						{hasPassword && (
							<label className={styles.field}>
								Password
								<input
									className={styles.input}
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
							</label>
						)}
						{error && <div className={styles.error}>{error}</div>}
						<Clickable
							className={styles.confirm_button}
							disabled={!canSubmit || isSubmitting}
							onClick={handleDelete}>
							{isSubmitting ? "Deleting…" : "Permanently delete account"}
						</Clickable>
					</div>
				</div>
			)}
		</div>
	);
}
