import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { getAvatarGroups } from "@/server/avatars/avatar-catalog";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard/onboarding-wizard";
import { parseOnboardingStep } from "@/components/onboarding/onboarding-step";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return { title: dict.pageTitles.onboarding };
}

type Props = {
	searchParams: Promise<{ step?: string }>;
};

export default async function OnboardingPage({ searchParams }: Props) {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	// Read from DB, not session, since avatar/onboarding actions write DB directly without refreshing the JWT.
	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: {
			name: true,
			username: true,
			image: true,
			preferredLanguage: true,
			newsletterOptIn: true,
			listAddEmailOptIn: true,
		},
	});
	if (!user) redirect("/login");

	return (
		<OnboardingWizard
			initial={{
				name: user.name,
				username: user.username,
				image: user.image,
				preferredLanguage: user.preferredLanguage,
				newsletterOptIn: user.newsletterOptIn,
				listAddEmailOptIn: user.listAddEmailOptIn,
			}}
			avatarGroups={getAvatarGroups()}
			initialStep={parseOnboardingStep((await searchParams).step)}
		/>
	);
}
