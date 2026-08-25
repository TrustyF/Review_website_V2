import { readdirSync } from "fs";
import path from "path";
import { AvatarGroup, AvatarOption } from "@/lib/avatars";

const AVATARS_DIR = path.join(process.cwd(), "public", "avatars");

// Every file under public/avatars is a picker option, named
// <name>_<number> — the name groups options together (e.g. ghibli_0.webp,
// ghibli_1.webp for one "ghibli" group) and can be multiple words, with a
// hyphen standing in for the space (best-of-the-worst_0.webp) — hyphen is
// unambiguous here specifically because `_` is reserved as the one
// name/number separator, so a name can use `-` freely without it being
// mistaken for that separator. Nothing else needs registering anywhere,
// dropping in a new file is the entire authoring step. Anything not
// matching this (a stray unrenamed upload, a README, ...) is silently
// skipped rather than erroring, so the directory can hold works-in-progress
// without breaking the picker.
const AVATAR_FILENAME = /^([a-zA-Z][a-zA-Z-]*)_(\d+)\.(png|jpe?g|webp|gif|svg)$/i;

// Re-reads the directory on every call rather than caching — this only runs
// server-side per request (account page load, updateAvatar's validation),
// and Next's own dev/prod file-system caching already makes readdirSync
// cheap enough that a manually-invalidated cache would just be extra
// complexity for no measurable win.
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
