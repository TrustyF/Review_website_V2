import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { DigestPageClient } from "./digest-page-client";

// Admin area for the weekly digest email: override its banner
// (src/emails/components/digest-banner.tsx) and trigger sends manually.
export default async function DigestPage() {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") notFound();

	const settings = await db.settings.findUnique({ where: { id: 1 } });

	return (
		<DigestPageClient
			initial={{
				image: settings?.digestBannerImage ?? null,
				headline: settings?.digestBannerHeadline ?? null,
				subtitle: settings?.digestBannerSubtitle ?? null,
			}}
		/>
	);
}
