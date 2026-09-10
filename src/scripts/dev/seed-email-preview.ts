import { writeFile } from "fs/promises";
import path from "path";
import { db } from "@/server/db/client";
import { buildDigestEmailProps } from "@/server/email/digest-email-props";

// Refreshes latest-activity-email.tsx's PreviewProps from real current data,
// so `npm run email_dev` reflects this week's actual digest, not a stale fixture.
const OUT_PATH = path.join(
	process.cwd(),
	"src/emails/preview-data/latest-activity-email.json",
);

async function main() {
	const props = await buildDigestEmailProps("en");
	if (!props) {
		console.error(
			"No rating/review activity in the past week — nothing to seed, left the existing preview data as-is.",
		);
		process.exit(1);
	}

	await writeFile(
		OUT_PATH,
		JSON.stringify(
			{ ...props, unsubscribeUrl: "https://example.com/api/unsubscribe?token=preview" },
			// dict omitted — its functions wouldn't survive JSON serialization;
			// latest-activity-email.tsx fills a fresh one in when it reads this file.
			(key, value) => (key === "dict" ? undefined : value),
			"\t",
		) + "\n",
	);
	console.log(`Wrote ${OUT_PATH}`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
