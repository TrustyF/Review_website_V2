"use client";
import { createContext, ReactNode, useContext, useState } from "react";
import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";
import styles from "./review.module.sass";

// http(s) only, or a same-site relative path — never a scheme like
// javascript: that could execute on click.
function isSafeUrl(url: string): boolean {
	if (url.startsWith("/")) return true;
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

// One shared "has any spoiler in this review been clicked yet" flag —
// clicking any spoiler reveals every spoiler in the same review at once,
// not just the one clicked. Scoped per-review (see ReviewSpoilerProvider,
// which review.tsx instantiates fresh for each review) rather than
// site-wide, so revealing one movie's spoilers doesn't touch another's.
const SpoilerRevealContext = createContext<{
	revealed: boolean;
	reveal: () => void;
}>({ revealed: false, reveal: () => {} });

// Wrap a whole review body in this once — every SpoilerText inside shares
// the one flag it provides.
export function ReviewSpoilerProvider({ children }: { children: ReactNode }) {
	const [revealed, setRevealed] = useState(false);
	return (
		<SpoilerRevealContext.Provider
			value={{ revealed, reveal: () => setRevealed(true) }}>
			{children}
		</SpoilerRevealContext.Provider>
	);
}

// Starts blanked out (background covers the text, same width so revealing
// it doesn't reflow the paragraph) — click or Enter/Space reveals it, and
// every other spoiler in the same review, permanently for this render.
function SpoilerText({ children }: { children: string }) {
	const { revealed, reveal } = useContext(SpoilerRevealContext);

	return (
		<span
			className={`${styles.spoiler} ${revealed ? styles.spoiler_revealed : ""}`}
			role="button"
			tabIndex={0}
			aria-label={revealed ? undefined : "Spoiler — click to reveal"}
			onClick={revealed ? undefined : reveal}
			onKeyDown={(e) => {
				if (revealed || (e.key !== "Enter" && e.key !== " ")) return;
				e.preventDefault();
				reveal();
			}}>
			{children}
		</span>
	);
}

// Renders one paragraph's worth of review body text with ||spoiler|| and
// [link](url) markup interpreted — everything else is plain text, rendered
// exactly as typed. A spoiler that spans a paragraph break (a literal blank
// line inside the ||...||) won't match, since paragraphs are split before
// this ever sees the text — an accepted limitation, not a bug.
export function ReviewBodyLine({ text }: { text: string }) {
	const nodes: ReactNode[] = [];
	let lastIndex = 0;
	let key = 0;

	for (const match of text.matchAll(REVIEW_MARKUP_REGEX)) {
		const index = match.index ?? 0;
		if (index > lastIndex) nodes.push(text.slice(lastIndex, index));

		if (match[1] !== undefined) {
			nodes.push(<SpoilerText key={key++}>{match[1]}</SpoilerText>);
		} else {
			const linkText = match[2]!;
			const url = match[3]!;
			if (isSafeUrl(url)) {
				const external = !url.startsWith("/");
				nodes.push(
					<a
						key={key++}
						href={url}
						className={styles.link}
						{...(external
							? { target: "_blank", rel: "noopener noreferrer" }
							: {})}>
						{linkText}
					</a>,
				);
			} else {
				// Unsafe scheme (e.g. javascript:) — render the raw markup as
				// plain text rather than a dead or dangerous link.
				nodes.push(match[0]);
			}
		}
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

	return <>{nodes}</>;
}
