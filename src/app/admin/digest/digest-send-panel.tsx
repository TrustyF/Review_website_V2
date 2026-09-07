"use client";
import { useState } from "react";
import { Clickable } from "@/components/ui/clickable";
import styles from "./digest.module.sass";
import { sendWeeklyDigestNow } from "./digest-send-actions";

type Status =
	| { state: "idle" | "confirming" | "sending" }
	| { state: "done"; sent: boolean; recipientCount?: number }
	| { state: "error"; message: string };

// There's no automatic schedule — this is the only way the digest goes out.
// Two-step confirm since this emails real subscribers.
export function DigestSendPanel() {
	const [status, setStatus] = useState<Status>({ state: "idle" });

	async function handleConfirm() {
		setStatus({ state: "sending" });
		try {
			const result = await sendWeeklyDigestNow();
			setStatus(
				result.sent
					? { state: "done", sent: true, recipientCount: result.recipientCount }
					: { state: "done", sent: false },
			);
		} catch {
			setStatus({ state: "error", message: "Failed to send. Check /admin/logs." });
		}
	}

	return (
		<div className={styles.send_panel}>
			<h2 className={styles.preview_heading}>Send now</h2>
			<p className={styles.send_description}>
				Sends the current weekly digest to every subscribed user right now.
				There&#39;s no automatic send — this is it.
			</p>

			{status.state === "idle" && (
				<Clickable
					className={styles.send_button}
					onClick={() => setStatus({ state: "confirming" })}>
					Send weekly digest now
				</Clickable>
			)}

			{status.state === "confirming" && (
				<div className={styles.send_confirm}>
					<span>Send to all subscribers now? This can&#39;t be undone.</span>
					<div className={styles.button_row}>
						<Clickable className={styles.send_button} onClick={handleConfirm}>
							Yes, send
						</Clickable>
						<Clickable
							className={styles.clear_button}
							onClick={() => setStatus({ state: "idle" })}>
							Cancel
						</Clickable>
					</div>
				</div>
			)}

			{status.state === "sending" && <div>Sending…</div>}

			{status.state === "done" && (
				<div className={styles.saved}>
					{status.sent
						? `Sent to ${status.recipientCount} subscriber(s).`
						: "No rating/review activity in the past week — nothing to send."}
				</div>
			)}

			{status.state === "error" && (
				<div className={styles.error}>{status.message}</div>
			)}
		</div>
	);
}
