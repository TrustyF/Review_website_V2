"use server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
	getInvocationCounts,
	resetInvocationCounts,
	type InvocationSnapshot,
} from "@/server/dev/invocation-tracker";

export async function fetchInvocationCounts(): Promise<InvocationSnapshot> {
	await requireAdmin();
	return getInvocationCounts();
}

export async function clearInvocationCounts(): Promise<InvocationSnapshot> {
	await requireAdmin();
	resetInvocationCounts();
	return getInvocationCounts();
}
