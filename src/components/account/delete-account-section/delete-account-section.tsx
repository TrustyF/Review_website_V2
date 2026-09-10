"use client";
import { useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { X } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import { useOutsideClick } from "@/lib/use-outside-click";
import { deleteAccount } from "@/components/account/account-actions";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./delete-account-section.module.sass";

const CONFIRM_PHRASE = "DELETE";

type Props = {
	// OAuth-only accounts have no password, so they skip straight to the confirmation-phrase gate.
	hasPassword: boolean;
};

export function DeleteAccountSection({ hasPassword }: Props) {
	const dict = useDictionary();
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
			setError(err instanceof Error ? err.message : dict.account.deleteAccountFailed);
			setIsSubmitting(false);
		}
	}

	return (
		<div className={styles.wrapper}>
			<h2 className={styles.title}>{dict.account.dangerZoneTitle}</h2>
			<p className={styles.subtitle}>{dict.account.dangerZoneSubtitle}</p>
			<Clickable className={styles.delete_button} onClick={openModal}>
				{dict.account.deleteAccount}
			</Clickable>

			{isOpen && (
				<div className={styles.modal_backdrop}>
					<div className={styles.modal_panel} ref={panelRef}>
						<div className={styles.modal_header}>
							<span>{dict.account.deleteAccount}</span>
							<Clickable
								className={styles.close_button}
								aria-label={dict.common.close}
								disabled={isSubmitting}
								onClick={() => setIsOpen(false)}>
								<X size={16} />
							</Clickable>
						</div>
						<p className={styles.warning}>{dict.account.deleteAccountWarning}</p>
						<label className={styles.field}>
							{dict.account.typeToConfirm(CONFIRM_PHRASE)}
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
								{dict.auth.password}
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
							{isSubmitting ? dict.account.deleting : dict.account.permanentlyDeleteAccount}
						</Clickable>
					</div>
				</div>
			)}
		</div>
	);
}
