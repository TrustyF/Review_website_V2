import { Company, Credit, Person } from "@prisma/client";
import { RawMediaRecord, toMediaRecord } from "@/components/media/types";
import { MediaSearchEntry } from "./media-search-grid";

type RawWithCredits = Omit<RawMediaRecord, "credits"> & {
	credits: (Credit & { person: Person | null; company: Company | null })[];
};

// Every row here is expected to come from a credits query filtered to
// role.name in ["Director", "Studio"] (see media-type-list-page.tsx and
// credit-media-list-page.tsx) — a Director credit is always personId, a
// Studio credit is always companyId, so no role check is needed here, just
// which relation came back populated.
export function toSearchEntry(raw: RawWithCredits): MediaSearchEntry {
	// The same person/company can have more than one credit row on a title
	// (see credit-media-list-page.tsx) — dedupe so matching doesn't need to
	// care.
	const directors = new Set<string>();
	const studios = new Set<string>();
	for (const credit of raw.credits) {
		if (credit.person) directors.add(credit.person.name);
		if (credit.company) studios.add(credit.company.name);
	}

	// Lowercased once here, at fetch time, rather than on every keystroke of
	// a search — see media-search-grid.tsx.
	const title = [raw.title, raw.alternateTitle]
		.filter((v): v is string => v != null)
		.join(" ")
		.toLowerCase();

	return {
		media: toMediaRecord(raw),
		searchText: {
			title,
			directors: [...directors].map((name) => name.toLowerCase()),
			studios: [...studios].map((name) => name.toLowerCase()),
			overview: raw.overview?.toLowerCase() ?? "",
		},
	};
}
