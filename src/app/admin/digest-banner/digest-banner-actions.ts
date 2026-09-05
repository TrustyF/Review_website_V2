"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { toAbsoluteUrl } from "@/server/email/mailer";
import {
	isDigestBannerOverrideUrl,
	saveDigestBannerOverride,
	saveDigestBannerOverrideFromUrl,
} from "@/server/resolvers/digest-banner-resolver";

// Settings is a singleton row, always id 1 — see prisma/schema/settings.prisma.
const SETTINGS_ID = 1;

export type DigestBannerOverride = {
	image: string | null;
	headline: string | null;
	subtitle: string | null;
};

// Normalizes image input (URL or pasted link) to self-hosted digest-override URL.
async function resolveOverrideImageUrl(
	raw: string | null,
): Promise<string | null> {
	const trimmed = raw?.trim();
	if (!trimmed) return null;
	if (isDigestBannerOverrideUrl(trimmed)) return trimmed;
	// AssetBrowser returns root-relative URL; needs absolute before fetch() server-side
	return saveDigestBannerOverrideFromUrl(toAbsoluteUrl(trimmed));
}

export async function updateDigestBannerOverride(
	input: DigestBannerOverride,
): Promise<void> {
	await requireAdmin();
	const data = {
		digestBannerImage: await resolveOverrideImageUrl(input.image),
		digestBannerHeadline: input.headline?.trim() || null,
		digestBannerSubtitle: input.subtitle?.trim() || null,
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
