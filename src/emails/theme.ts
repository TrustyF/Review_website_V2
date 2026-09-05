import type { TailwindConfig } from "@react-email/components";

// Light palette (mail clients auto-invert dark); keep synced with globals.sass
const colors = {
	bg: "#ffffff",
	"bg-2": "#f5f5f5", // --surface — card background
	fg: "#1a1a1a", // --ticket-ink — doubles as the email's foreground on white
	"fg-2": "#333333", // darker for white contrast; "fg-3": "#666666", // --accent1, unchanged
	stroke: "#e0e0e0", // --surface-border
	brand: "#ff860d", // --brand
	// --brand at ~2.4:1 contrast fails white text (WCAG needs 3:1+); its own
	// ink (#1a1a1a) clears 8.6:1, so brand buttons use dark text, not white.
	"brand-ink": "#1a1a1a",
	link: "#3a6ea5", // darkened from --link (#6699cc) — that value is under 3:1 contrast on white
} as const;

// No custom `mobile:` variant like the react-email demo templates use —
// our installed tailwindcss v4 dropped the v3 plugin() API that relies on.
export const EMAIL_TAILWIND_CONFIG: TailwindConfig = {
	theme: {
		extend: {
			colors,
			borderColor: {
				DEFAULT: colors.brand,
			},
			fontFamily: {
				// Playfair Display, loaded via <EmailFonts> alongside Inter —
				// used for the digest banner headline only.
				serif: ["Playfair Display", "Georgia", "serif"],
				// Loaded via <EmailFonts> alongside Inter/Playfair Display —
				// not used by any component yet, opt in with font-roboto.
				roboto: ["Roboto", "Arial", "sans-serif"],
			},
		},
	},
};
