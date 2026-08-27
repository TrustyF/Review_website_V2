import { readFile } from "fs/promises";
import {
	DeleteObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

// Uploads a pre-made pg_dump (see backup-database.yml, which invokes this
// after running `pg_dump | gzip` itself — no Postgres client library here,
// this script only ever touches R2) and prunes old ones down to a
// grandfather-father-son rotation:
//   - the 5 most recent dumps (short-term, ~5 days at the daily cron
//     cadence), plus
//   - the newest dump of each of the 3 most recent distinct months, plus
//   - the newest dump of every distinct year, kept forever.
// A dump can satisfy more than one tier at once (the newest dump is always
// also that month's and that year's representative) — the three sets just
// get unioned before deleting anything not in the union.
const SHORT_TERM_KEEP = 5;
const MONTHLY_KEEP = 3;

const KEY_PREFIX = "db/";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set.`);
	return value;
}

function getClient(): S3Client {
	return new S3Client({
		region: "auto",
		endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: requireEnv("R2_BACKUP_ACCESS_KEY_ID"),
			secretAccessKey: requireEnv("R2_BACKUP_SECRET_ACCESS_KEY"),
		},
	});
}

// Filenames are the dump's own creation timestamp (colons swapped for dashes
// so the key stays trivially safe across every S3-compatible tool), which
// both gives every run a unique key and is all the retention logic below
// needs to sort/group by.
function timestampedKey(now: Date): string {
	return `${KEY_PREFIX}${now.toISOString().replace(/:/g, "-")}.sql.gz`;
}

async function listBackups(bucket: string) {
	const client = getClient();
	const objects: { key: string; date: Date }[] = [];
	let continuationToken: string | undefined;
	do {
		const page = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: KEY_PREFIX,
				ContinuationToken: continuationToken,
			}),
		);
		for (const object of page.Contents ?? []) {
			if (!object.Key) continue;
			const iso = object.Key.slice(KEY_PREFIX.length).replace(/\.sql\.gz$/, "");
			// Reverse the ":" -> "-" swap from timestampedKey just for the two
			// colons inside the time-of-day portion, so Date can parse it back.
			const date = new Date(iso.replace(/T(\d\d)-(\d\d)-(\d\d)/, "T$1:$2:$3"));
			if (!Number.isNaN(date.getTime())) objects.push({ key: object.Key, date });
		}
		continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
	} while (continuationToken);
	return objects.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function monthKey(d: Date) {
	return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

function yearKey(d: Date) {
	return `${d.getUTCFullYear()}`;
}

function computeKeep(backups: { key: string; date: Date }[]): Set<string> {
	const keep = new Set<string>();

	for (const b of backups.slice(0, SHORT_TERM_KEEP)) keep.add(b.key);

	const newestPerMonth = new Map<string, { key: string; date: Date }>();
	for (const b of backups) {
		const mk = monthKey(b.date);
		if (!newestPerMonth.has(mk)) newestPerMonth.set(mk, b);
	}
	for (const b of [...newestPerMonth.values()].slice(0, MONTHLY_KEEP)) {
		keep.add(b.key);
	}

	const newestPerYear = new Map<string, { key: string; date: Date }>();
	for (const b of backups) {
		const yk = yearKey(b.date);
		if (!newestPerYear.has(yk)) newestPerYear.set(yk, b);
	}
	for (const b of newestPerYear.values()) keep.add(b.key);

	return keep;
}

async function main() {
	const dumpPath = process.argv[2];
	if (!dumpPath) {
		console.error("Usage: tsx backup-database.ts <path-to-dump.sql.gz>");
		process.exit(1);
	}

	const bucket = requireEnv("R2_BACKUP_BUCKET_NAME");
	const client = getClient();
	const now = new Date();
	const key = timestampedKey(now);

	const body = await readFile(dumpPath);
	await client.send(
		new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }),
	);
	console.log(`Uploaded ${key} (${body.byteLength} bytes).`);

	const backups = await listBackups(bucket);
	const keep = computeKeep(backups);
	const toDelete = backups.filter((b) => !keep.has(b.key));

	for (const b of toDelete) {
		await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: b.key }));
	}

	console.log(
		`Retention: kept ${keep.size} backup${keep.size === 1 ? "" : "s"}, ` +
			`deleted ${toDelete.length}.`,
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
