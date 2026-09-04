import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { DigestBannerPageClient } from "./digest-banner-page-client";

// Lets an admin override the weekly digest email's banner (see
// src/emails/components/digest-banner.tsx) instead of it always being
// derived from the featured title's backdrop — see send-weekly-digest.ts.
export default async function DigestBannerPage() {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") notFound();

	const settings = await db.settings.findUnique({ where: { id: 1 } });

	return (
		<DigestBannerPageClient
			initial={{
				image: settings?.digestBannerImage ?? null,
				headline: settings?.digestBannerHeadline ?? null,
				subtitle: settings?.digestBannerSubtitle ?? null,
				positionY: settings?.digestBannerPositionY ?? 50,
			}}
		/>
	);
}
