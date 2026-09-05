import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { verifyUnsubscribeToken } from "@/server/email/unsubscribe-token";

export async function GET(req: Request) {
	const token = new URL(req.url).searchParams.get("token");
	const parsed = token ? verifyUnsubscribeToken(token) : null;

	if (!parsed) redirect("/unsubscribed?status=invalid");

	try {
		await db.user.update({
			where: { id: parsed.userId },
			data: { [parsed.field]: false },
		});
	} catch {
		// Token was validly signed but the user no longer exists (deleted account).
		redirect("/unsubscribed?status=invalid");
	}

	redirect("/unsubscribed?status=ok");
}
