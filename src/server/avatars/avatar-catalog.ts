import { readdirSync } from "fs";
import path from "path";
import { AvatarGroup, AvatarOption } from "@/lib/avatars";

const AVATARS_DIR = path.join(process.cwd(), "public", "avatars");

// Files are named <name>_<number>, name groups options into a picker group; non-matching files are silently skipped.
const AVATAR_FILENAME = /^([a-zA-Z][a-zA-Z-]*)_(\d+)\.(png|jpe?g|webp|gif|svg)$/i;

// Re-reads on every call: infrequent server-side use plus Next's fs caching makes readdirSync cheap enough to skip caching this.
export function getAvatarGroups(): AvatarGroup[] {
	let filenames: string[];
	try {
		filenames = readdirSync(AVATARS_DIR);
	} catch {
		// No public/avatars dir yet — an empty catalog, not a crash.
		return [];
	}

	const byName = new Map<string, { num: number; option: AvatarOption }[]>();
	for (const filename of filenames) {
		const match = AVATAR_FILENAME.exec(filename);
		if (!match) continue;
		const [, name, num] = match;
		if (!name || !num) continue;

		const key = name.toLowerCase();
		const entry = { num: Number(num), option: { id: filename, src: `/avatars/${filename}` } };
		const existing = byName.get(key);
		if (existing) existing.push(entry);
		else byName.set(key, [entry]);
	}

	return [...byName.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, entries]) => ({
			name,
			options: entries.sort((a, b) => a.num - b.num).map((entry) => entry.option),
		}));
}

export function isValidAvatarSrc(src: string): boolean {
	return getAvatarGroups().some((group) =>
		group.options.some((option) => option.src === src),
	);
}
