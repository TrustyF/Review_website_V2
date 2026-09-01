"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	listRecommendationTargets,
	RecommendationTargetOption,
} from "@/components/lists/list-actions";
import { UserPicker } from "@/components/lists/list-form/user-picker";
import styles from "./user-lists.module.sass";

// Admin's entry point into a specific user's context: picking a user navigates
// to /admin/users/[id], where their lists live and new ones are pre-scoped to them.
export default function UserListsPage() {
	const [targets, setTargets] = useState<RecommendationTargetOption[]>([]);
	const router = useRouter();

	useEffect(() => {
		listRecommendationTargets().then(setTargets);
	}, []);

	return (
		<div className={styles.wrapper}>
			<h1>User lists</h1>
			<p className={styles.hint}>
				Pick a user to work in their account context — view and manage the
				recommendation lists deposited into it.
			</p>

			<UserPicker
				options={targets}
				value={null}
				onChange={(id) => id && router.push(`/admin/users/${id}`)}
				hidePublicOption
			/>
		</div>
	);
}
