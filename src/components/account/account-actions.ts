"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { auth } from "@/auth";

export type AccountSettingsInput = {
	preferredLanguage: string;
	newsletterOptIn: boolean;
};

export async function updateAccountSettings(
	input: AccountSettingsInput,
): Promise<void> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");

	await db.user.update({
		where: { id: session.user.id },
		data: {
			preferredLanguage: input.preferredLanguage,
			newsletterOptIn: input.newsletterOptIn,
		},
	});

	revalidatePath("/account");
}
