import { db } from "@/server/db/client";
import { UserRole } from "@prisma/client";

// One-off bootstrap for the site owner's own account — signup is open/self-
// serve with no seed data, so there's no other way to get the first ADMIN.
// Sign up normally at /signup, then run this once against that email.
async function main() {
	const [, , email] = process.argv;
	if (!email) {
		console.error("Usage: npm run promote_admin -- <email>");
		process.exit(1);
	}

	const user = await db.user.update({
		where: { email },
		data: { role: UserRole.ADMIN },
	});

	console.log(`${user.email} is now an ADMIN.`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
