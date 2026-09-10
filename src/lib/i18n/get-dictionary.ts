import { getLocale, type Locale } from "@/lib/i18n/get-locale";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";

const dictionaries: Record<Locale, Dictionary> = { en, fr };

export async function getDictionary(): Promise<Dictionary> {
	const locale = await getLocale();
	return dictionaries[locale];
}

export type { Dictionary } from "@/lib/i18n/dictionaries/en";
