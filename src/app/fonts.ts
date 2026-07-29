import {
	Geist,
	Geist_Mono,
	IBM_Plex_Sans,
	Source_Serif_4,
} from "next/font/google";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const geistSerif = Source_Serif_4({
	variable: "--font-geist-serif",
	subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
	variable: "--font-ibm-plex-sans",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

// Applied to <html> so every font's CSS variable is available everywhere;
// which one actually gets used per element is up to $font-sans/$font-mono/
// $font-serif/$font-body in variables.sass.
export const fontVariables = `${geistSans.variable} ${geistMono.variable} ${geistSerif.variable} ${ibmPlexSans.variable}`;
