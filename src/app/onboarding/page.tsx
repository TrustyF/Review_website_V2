import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { getAvatarGroups } from "@/server/avatars/avatar-catalog";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard/onboarding-wizard";

export default async function OnboardingPage() {
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
			}}
			avatarGroups={getAvatarGroups()}
		/>
	);
}
