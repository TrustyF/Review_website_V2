"use client";
import { createContext, ReactNode, useContext } from "react";
import type { Locale } from "@/lib/i18n/get-locale";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";

// Dictionary values include functions (e.g. `gapDaysLater(n)`), which can't
// cross the Server->Client boundary — so only `locale` (a string) does, and
// the dictionary is picked from this client-bundled map instead.
const dictionaries: Record<Locale, Dictionary> = { en, fr };

const I18nContext = createContext<Locale | undefined>(undefined);

// Seeded from the server (layout.tsx resolves locale before first paint)
// rather than self-fetching client-side, to avoid an English-then-French flash.
export function I18nProvider({
	locale,
	children,
}: {
	locale: Locale;
	children: ReactNode;
}) {
	return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useLocale(): Locale {
	const locale = useContext(I18nContext);
	if (!locale) throw new Error("useDictionary/useLocale must be used within I18nProvider");
	return locale;
}

export function useDictionary(): Dictionary {
	return dictionaries[useLocale()];
}
