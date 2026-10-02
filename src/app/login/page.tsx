import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Suspense } from "react";
import { LoginPage } from "@/components/auth/login-page/login-page";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return { title: dict.auth.signIn };
}

export default function Login() {
	return (
		<Suspense>
			<LoginPage />
		</Suspense>
	);
}
