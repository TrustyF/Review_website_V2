"use client";
import { useEffect, useState } from "react";
import {
	getListsForUser,
	listRecommendationTargets,
	RecommendationTargetOption,
	UserListSummary,
} from "@/components/lists/list-actions";
import { UserPicker } from "@/components/lists/list-form/user-picker";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import styles from "./user-lists.module.sass";

// Admin-only browser for navigating straight to any user's recommendation
// lists (List.targetUserId — see list.prisma's own comment) instead of
// having to sign in as them. Reuses UserPicker/listRecommendationTargets,
// the same "recommend to" picker ListForm already uses, so choosing a user
// here looks and behaves exactly like choosing one there.
export default function UserListsPage() {
	const [targets, setTargets] = useState<RecommendationTargetOption[]>([]);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	const [lists, setLists] = useState<UserListSummary[]>([]);
	// Which user `lists` was actually fetched for — compared against
	// selectedUserId below to derive the loading state, rather than a
	// separate isLoading flag set synchronously at the top of the effect
	// (which react-hooks/set-state-in-effect flags as a cascading-render
	// risk — see AGENTS.md's eslint note).
	const [listsUserId, setListsUserId] = useState<string | null>(null);

	useEffect(() => {
		listRecommendationTargets().then(setTargets);
	}, []);

	useEffect(() => {
		if (!selectedUserId) return;
		getListsForUser(selectedUserId).then((result) => {
			setLists(result);
			setListsUserId(selectedUserId);
		});
	}, [selectedUserId]);

	const isLoadingLists =
		selectedUserId !== null && selectedUserId !== listsUserId;

	return (
		<div className={styles.wrapper}>
			<h1>User lists</h1>
			<p className={styles.hint}>
				Pick a user to see the recommendation lists deposited into their
				account.
			</p>

			<UserPicker
				options={targets}
				value={selectedUserId}
				onChange={setSelectedUserId}
			/>

			{selectedUserId &&
				(isLoadingLists ? (
					<div className={styles.spinner} />
				) : lists.length === 0 ? (
					<p className={styles.empty}>
						Nothing recommended to this user yet.
					</p>
				) : (
					<div className={styles.grid}>
						{lists.map((list) => (
							<ListPreviewCard
								key={list.id}
								id={list.id}
								title={list.title}
								description={list.description}
								thumbnail={list.thumbnail}
								itemCount={list.itemCount}
							/>
						))}
					</div>
				))}
		</div>
	);
}
