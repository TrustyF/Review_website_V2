"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sendRecommendationRequestAlert } from "@/server/email/send-recommendation-request-alert";
import type { RecommendationRequestStatus } from "@prisma/client";

async function requireUserId(): Promise<string> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");
	return session.user.id;
}

export type MyRecommendationRequest = {
	id: number;
	message: string;
	status: RecommendationRequestStatus;
	createdAt: Date;
	fulfilledListId: number | null;
};

// One PENDING request per user at a time; app-level check, not a DB
// constraint — a race is harmless at this app's scale.
export async function createRecommendationRequest(message: string): Promise<void> {
	const userId = await requireUserId();
	const trimmed = message.trim();
	if (!trimmed) throw new Error("Message is required");

	const existingPending = await db.recommendationRequest.findFirst({
		where: { userId, status: "PENDING" },
		select: { id: true },
	});
	if (existingPending) throw new Error("You already have a pending request");

	const request = await db.recommendationRequest.create({
		data: { userId, message: trimmed },
	});

	// Best-effort — a failed alert email shouldn't fail the user's submission.
	try {
		await sendRecommendationRequestAlert(request.id);
	} catch (err) {
		console.error("Failed to send recommendation request alert email", err);
	}

	revalidatePath("/account/recommendation-request");
}

export async function getMyRecommendationRequests(): Promise<MyRecommendationRequest[]> {
	const userId = await requireUserId();
	return db.recommendationRequest.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			message: true,
			status: true,
			createdAt: true,
			fulfilledListId: true,
		},
	});
}

export type AdminRecommendationRequest = {
	id: number;
	message: string;
	status: RecommendationRequestStatus;
	createdAt: Date;
	user: { id: string; username: string | null; name: string | null; email: string | null };
};

export async function getRecommendationRequestsForAdmin(
	status?: RecommendationRequestStatus,
): Promise<AdminRecommendationRequest[]> {
	await requireAdmin();
	return db.recommendationRequest.findMany({
		...(status ? { where: { status } } : {}),
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			message: true,
			status: true,
			createdAt: true,
			user: { select: { id: true, username: true, name: true, email: true } },
		},
	});
}

export async function getPendingRecommendationRequestCount(): Promise<number> {
	await requireAdmin();
	return db.recommendationRequest.count({ where: { status: "PENDING" } });
}

export async function dismissRecommendationRequest(id: number): Promise<void> {
	await requireAdmin();
	await db.recommendationRequest.update({
		where: { id },
		data: { status: "DISMISSED", resolvedAt: new Date() },
	});
	revalidatePath("/admin/recommendation-requests");
}

// Called by the new-list flow when reached via a request's "Create list for
// this user" shortcut (see new-list/page.tsx's requestId handling).
export async function fulfillRecommendationRequestWithList(
	id: number,
	listId: number,
): Promise<void> {
	await requireAdmin();
	await db.recommendationRequest.update({
		where: { id },
		data: { status: "FULFILLED", resolvedAt: new Date(), fulfilledListId: listId },
	});
	revalidatePath("/admin/recommendation-requests");
}
