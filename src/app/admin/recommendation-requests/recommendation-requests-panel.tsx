"use client";
import { useState } from "react";
import { Link } from "@/components/ui/link";
import { Clickable } from "@/components/ui/clickable";
import {
	AdminRecommendationRequest,
	dismissRecommendationRequest,
} from "@/components/recommendations/recommendation-request-actions";
import { displayName } from "@/lib/display-name";
import { listDateFormatterFor } from "@/lib/format-list-date";
import styles from "./recommendation-requests.module.sass";

// Admin-only, no i18n locale context — always English.
const DateFormatter = listDateFormatterFor("en");

type Tab = "PENDING" | "ALL";

export function RecommendationRequestsPanel({
	initialRequests,
}: {
	initialRequests: AdminRecommendationRequest[];
}) {
	const [requests, setRequests] = useState(initialRequests);
	const [tab, setTab] = useState<Tab>("PENDING");
	const [pendingId, setPendingId] = useState<number | null>(null);

	const visible = requests.filter((r) => tab === "ALL" || r.status === "PENDING");
	const pendingCount = requests.filter((r) => r.status === "PENDING").length;

	async function handleDismiss(id: number) {
		setPendingId(id);
		try {
			await dismissRecommendationRequest(id);
			setRequests((prev) =>
				prev.map((r) => (r.id === id ? { ...r, status: "DISMISSED" } : r)),
			);
		} finally {
			setPendingId(null);
		}
	}

	return (
		<div className={styles.panel}>
			<div className={styles.tabs}>
				<Clickable
					className={`${styles.tab} ${tab === "PENDING" ? styles.tab_active : ""}`}
					aria-pressed={tab === "PENDING"}
					onClick={() => setTab("PENDING")}>
					Pending ({pendingCount})
				</Clickable>
				<Clickable
					className={`${styles.tab} ${tab === "ALL" ? styles.tab_active : ""}`}
					aria-pressed={tab === "ALL"}
					onClick={() => setTab("ALL")}>
					All
				</Clickable>
			</div>

			{visible.length === 0 ? (
				<p className={styles.empty}>Nothing here.</p>
			) : (
				<ul className={styles.list}>
					{visible.map((request) => (
						<li key={request.id} className={styles.row}>
							<div className={styles.row_header}>
								<Link
									href={`/admin/users/${request.user.id}`}
									className={styles.requester}>
									{displayName(request.user)}
								</Link>
								<span className={styles.date}>
									{DateFormatter.format(request.createdAt)}
								</span>
							</div>
							<p className={styles.message}>{request.message}</p>
							{request.status === "PENDING" && (
								<div className={styles.actions}>
									<Link
										href={`/admin/users/${request.user.id}/lists/new?requestId=${request.id}`}
										className={styles.create_list_link}>
										Create list for this user
									</Link>
									<Clickable
										className={styles.dismiss_button}
										disabled={pendingId === request.id}
										onClick={() => handleDismiss(request.id)}>
										Dismiss
									</Clickable>
								</div>
							)}
							{request.status !== "PENDING" && (
								<span className={styles.status_label}>
									{request.status === "FULFILLED" ? "Fulfilled" : "Dismissed"}
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
