import { Suspense } from "react";
import { LoginPage } from "@/components/auth/login-page/login-page";

export default function Login() {
	return (
		<Suspense>
			<LoginPage />
		</Suspense>
	);
}
