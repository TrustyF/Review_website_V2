import type { TailwindConfig } from "@react-email/components";

// A light palette, not a direct lift of globals.sass's dark :root tokens —
// mail clients auto-invert dark emails, so white is the safer background.
// Keep in sync by hand if globals.sass's tokens change.
const colors = {
	bg: "#ffffff",
	"bg-2": "#f5f5f5", // --surface — card background
	fg: "#1a1a1a", // --ticket-ink — doubles as the email's foreground on white
	"fg-2": "#333333", // darker than --body (#cccccc, tuned for dark bg) for contrast on white
	"fg-3": "#666666", // --accent1 — unchanged, still reads fine on white
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
			fontFamily: {
				// Inter, not Geist ($font-sans) — Geist can't load as a web font
				// in a mail client; Inter is loaded via theme-fonts.tsx's
				// <EmailFonts>, same as react-email's own demo templates.
				sans: ["Inter", "Arial", "Helvetica", "sans-serif"],
			},
		},
	},
};
