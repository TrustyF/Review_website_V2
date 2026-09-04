"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { saveDigestBannerOverride } from "@/server/resolvers/digest-banner-resolver";

// Settings is a singleton row, always id 1 — see prisma/schema/settings.prisma.
const SETTINGS_ID = 1;

export type DigestBannerOverride = {
	image: string | null;
	headline: string | null;
	subtitle: string | null;
	// 0-100, vertical crop focus — see prisma/schema/settings.prisma.
	positionY: number;
};

export async function updateDigestBannerOverride(
	input: DigestBannerOverride,
): Promise<void> {
	await requireAdmin();
	const data = {
		digestBannerImage: input.image?.trim() || null,
		digestBannerHeadline: input.headline?.trim() || null,
		digestBannerSubtitle: input.subtitle?.trim() || null,
		digestBannerPositionY: Math.min(
			100,
			Math.max(0, Math.round(input.positionY)),
		),
	};

	await db.settings.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, ...data },
		update: data,
	});

	revalidatePath("/admin/digest-banner");
}

// Alternative to pasting a URL: saves a locally-picked file and returns a URL for the same image field.
export async function uploadDigestBannerImage(
	formData: FormData,
): Promise<string> {
	await requireAdmin();
	const file = formData.get("file");
	if (!(file instanceof File)) throw new Error("No file provided");

	const bytes = Buffer.from(await file.arrayBuffer());
	return saveDigestBannerOverride(bytes);
}
