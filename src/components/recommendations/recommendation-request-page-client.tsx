"use client";
import { useState } from "react";
import { Link } from "@/components/ui/link";
import { Clickable } from "@/components/ui/clickable";
import {
	createRecommendationRequest,
	MyRecommendationRequest,
} from "@/components/recommendations/recommendation-request-actions";
import { useDictionary, useLocale } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { listDateFormatterFor } from "@/lib/format-list-date";
import styles from "./recommendation-request-page.module.sass";

function statusLabel(
	status: MyRecommendationRequest["status"],
	dict: Dictionary,
): string {
	switch (status) {
		case "PENDING":
			return dict.recommendationRequest.statusPending;
		case "FULFILLED":
			return dict.recommendationRequest.statusFulfilled;
		case "DISMISSED":
			return dict.recommendationRequest.statusDismissed;
	}
}

export function RecommendationRequestPageClient({
	initialRequests,
}: {
	initialRequests: MyRecommendationRequest[];
}) {
	const dict = useDictionary();
	const locale = useLocale();
	const dateFormatter = listDateFormatterFor(locale);

	const [requests, setRequests] = useState(initialRequests);
	const [message, setMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const pending = requests.find((r) => r.status === "PENDING") ?? null;
	const history = requests.filter((r) => r !== pending);

	async function handleSubmit() {
		const trimmed = message.trim();
		if (!trimmed) return;
		setIsSubmitting(true);
		setError(null);
		try {
			await createRecommendationRequest(trimmed);
			setRequests((prev) => [
				{
					id: -Date.now(),
					message: trimmed,
					status: "PENDING",
					createdAt: new Date(),
					fulfilledListId: null,
				},
				...prev,
			]);
			setMessage("");
		} catch {
			setError(dict.recommendationRequest.submitFailed);
			setIsSubmitting(false);
			return;
		}
		setIsSubmitting(false);
	}

	return (
		<>
			{pending ? (
				<div className={styles.pending_panel}>
					<p className={styles.pending_label}>
						{dict.account.askForRecommendationPending}
					</p>
					<p className={styles.pending_message}>{pending.message}</p>
				</div>
			) : (
				<div className={styles.form}>
					<textarea
						className={styles.textarea}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						// placeholder={dict.recommendationRequest.messagePlaceholder}
						autoFocus
					/>
					{error && <div className={styles.error}>{error}</div>}
					<Clickable
						className={styles.submit_button}
						disabled={isSubmitting || !message.trim()}
						onClick={handleSubmit}>
						{isSubmitting
							? dict.recommendationRequest.submitting
							: dict.recommendationRequest.submit}
					</Clickable>
				</div>
			)}

			<h2 className={styles.history_title}>
				{dict.recommendationRequest.historyTitle}
			</h2>
			{history.length === 0 ? (
				<p className={styles.empty}>
					{dict.recommendationRequest.historyEmpty}
				</p>
			) : (
				<ul className={styles.history_list}>
					{history.map((request) => (
						<li key={request.id} className={styles.history_row}>
							<div className={styles.history_row_header}>
								<span className={styles.history_status}>
									{statusLabel(request.status, dict)}
								</span>
								<span className={styles.history_date}>
									{dateFormatter.format(request.createdAt)}
								</span>
							</div>
							<p className={styles.history_message}>{request.message}</p>
							{request.fulfilledListId && (
								<Link
									href={`/lists/${request.fulfilledListId}`}
									className={styles.history_list_link}>
									{dict.recommendationRequest.viewList}
								</Link>
							)}
						</li>
					))}
				</ul>
			)}
		</>
	);
}
