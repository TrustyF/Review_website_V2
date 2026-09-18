import { writeFile } from "fs/promises";
import path from "path";

// Refreshes src/lib/identity.generated.json from arthur_apex's identity.json
// before each `npm run build`. Leaves the committed file as-is on failure —
// a stale identity is fine, a missing one isn't.
const OUTPUT_PATH = path.join(process.cwd(), "src/lib/identity.generated.json");

async function main() {
	try {
		const res = await fetch("https://arthursirjacobs.com/identity.json");
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const identity = await res.json();
		await writeFile(OUTPUT_PATH, `${JSON.stringify(identity, null, "\t")}\n`);
		console.log("fetch-identity: refreshed identity.generated.json from apex.");
	} catch (err) {
		console.warn(
			`fetch-identity: could not reach apex (${err}) — keeping the committed identity.generated.json.`,
		);
	}
}

main();
