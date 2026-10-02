import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { SignupPage } from "@/components/auth/signup-page/signup-page";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return { title: dict.auth.createAccountTitle };
}

export default function Signup() {
	return <SignupPage />;
}
