"use client";
import { Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListForm } from "@/components/lists/list-form/list-form";
import { createList } from "@/components/lists/list-actions";
import { fulfillRecommendationRequestWithList } from "@/components/recommendations/recommendation-request-actions";
import styles from "./new-list.module.sass";

// Also reachable via ?requestId=… (recommendation-requests-panel.tsx's
// "Create list for this user"), which also fulfills that request on submit.
// useSearchParams needs its own Suspense boundary, split out like /login.
function NewUserListForm({ id }: { id: string }) {
	const router = useRouter();
	const requestId = useSearchParams().get("requestId");

	return (
		<ListForm
			initial={{
				title: "",
				titleFr: "",
				description: "",
				descriptionFr: "",
				thumbnailUrl: "",
				sortMode: "RANKED",
				targetUserId: id,
			}}
			submitLabel="Create"
			hideRecommendTo
			onSubmit={async ({
				title,
				titleFr,
				description,
				descriptionFr,
				thumbnailUrl,
				sortMode,
			}) => {
				const listId = await createList({
					title,
					titleFr: titleFr.trim() || null,
					description: description.trim() || null,
					descriptionFr: descriptionFr.trim() || null,
					thumbnailUrl: thumbnailUrl.trim() || null,
					sortMode,
					targetUserId: id,
				});
				if (requestId) {
					await fulfillRecommendationRequestWithList(Number(requestId), listId);
					router.push("/admin/recommendation-requests");
					return;
				}
				router.push(`/admin/users/${id}/lists`);
			}}
		/>
	);
}

// Same form as /lists/new, but pre-scoped to one user — reached from their
// /admin/users/[id]/lists page, so there's no "recommend to" picker to fill in.
export default function NewUserListPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);

	return (
		<div className={styles.wrapper}>
			<h1>New list</h1>
			<Suspense>
				<NewUserListForm id={id} />
			</Suspense>
		</div>
	);
}
