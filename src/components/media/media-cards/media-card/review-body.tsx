"use client";
import {
	createContext,
	type KeyboardEvent as ReactKeyboardEvent,
	ReactNode,
	useContext,
	useState,
} from "react";
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

// The accessible name a screen reader gets while a spoiler is unrevealed —
// there's no visible on-screen label (see review.module.sass's .spoiler_text
// for the actual redacted-lines look), so this is the only place this
// wording shows up.
const SPOILER_LABEL = "Spoilers, click to reveal";

// Starts blanked out — click or Enter/Space reveals it, and every other
// spoiler in the same review, permanently for this render. Renders inline,
// sitting mid-sentence like a highlighted span rather than breaking onto
// its own line — see review.module.sass's .spoiler.
//
// interactive=false (featured-review.tsx's excerpt) drops all of that —
// no role/tabIndex/aria-label/handlers, so a click has nothing of this
// element's own to do and just bubbles up untouched. That's specifically
// for when this whole thing is already nested inside an ancestor <Link>
// (the featured hero card, which navigates to the review page on click):
// a real click-to-reveal button nested inside a navigating link is exactly
// the kind of thing that either breaks (invalid nested interactive
// content) or needs event-hijacking to stop the navigation, and here the
// navigation is the wanted behavior, not something to prevent — so this
// just gets out of the way instead. Always renders unrevealed in that mode
// (there's no way to trigger a reveal without the handlers), which is also
// the point: a spoiler about to navigate away is never worth revealing in
// place.
function SpoilerText({
	children,
	interactive = true,
}: {
	children: string;
	interactive?: boolean;
}) {
	const { revealed, reveal } = useContext(SpoilerRevealContext);
	const isRevealed = interactive && revealed;

	return (
		<span
			className={`${styles.spoiler} ${isRevealed ? styles.spoiler_revealed : ""}`}
			role={interactive ? "button" : undefined}
			tabIndex={interactive ? 0 : undefined}
			aria-label={interactive && !isRevealed ? SPOILER_LABEL : undefined}
			onClick={interactive && !isRevealed ? reveal : undefined}
			onKeyDown={
				interactive
					? (e: ReactKeyboardEvent) => {
							if (isRevealed || (e.key !== "Enter" && e.key !== " ")) return;
							e.preventDefault();
							reveal();
						}
					: undefined
			}>
			<span className={styles.spoiler_text}>{children}</span>
		</span>
	);
}

// A paragraph's worth of inline content — plain text, links, and spoilers
// all sit in the same flow, split apart only on \n\n. A spoiler is inline
// just like a link: it never forces a paragraph break of its own, even
// when its captured text itself contains a \n\n — see splitReviewBody.
type ReviewBodyBlock = { key: number; nodes: ReactNode[] };

// Parses ||spoiler|| and [text](url) markup over the *entire* input in one
// pass, unlike the old per-paragraph approach this replaced — REVIEW_MARKUP
// _REGEX's [\s\S] already matches across newlines, so the only reason a
// spoiler couldn't span a paragraph break before was that callers split the
// body on \n\n before any of this ever ran. Plain text between/around
// matches still gets split into separate paragraph blocks on \n\n — a
// spoiler match itself never does, even when its own captured text
// contains one, since that's exactly the case this exists to support.
function splitReviewBody(
	text: string,
	spoilersInteractive: boolean,
): ReviewBodyBlock[] {
	const blocks: ReviewBodyBlock[] = [];
	let currentNodes: ReactNode[] = [];
	let blockKey = 0;
	let inlineKey = 0;

	function flushParagraph() {
		if (currentNodes.length === 0) return;
		blocks.push({ key: blockKey++, nodes: currentNodes });
		currentNodes = [];
	}

	function pushPlainText(raw: string) {
		const pieces = raw.split("\n\n");
		pieces.forEach((piece, i) => {
			if (i > 0) flushParagraph();
			if (piece) currentNodes.push(piece);
		});
	}

	let lastIndex = 0;
	for (const match of text.matchAll(REVIEW_MARKUP_REGEX)) {
		const index = match.index ?? 0;
		if (index > lastIndex) pushPlainText(text.slice(lastIndex, index));

		if (match[1] !== undefined) {
			currentNodes.push(
				<SpoilerText key={inlineKey++} interactive={spoilersInteractive}>
					{match[1]}
				</SpoilerText>,
			);
		} else {
			const linkText = match[2]!;
			const url = match[3]!;
			if (isSafeUrl(url)) {
				const external = !url.startsWith("/");
				currentNodes.push(
					<a
						key={inlineKey++}
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
				currentNodes.push(match[0]);
			}
		}
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) pushPlainText(text.slice(lastIndex));
	flushParagraph();

	return blocks;
}

type ReviewBodyProps = {
	text: string;
	// Applied to each paragraph's own <p> — spoilers render inline inside
	// whichever paragraph they fall in (see splitReviewBody), so this never
	// reaches a spoiler directly.
	paragraphClassName?: string | undefined;
	// Passed straight through to every spoiler in the body — see SpoilerText's
	// own comment on what false does and why (featured-review.tsx's hero
	// excerpt is the one caller that needs it: that whole card is already a
	// Link to the review page, so a spoiler's own click-to-reveal has to get
	// out of the way rather than fight that navigation).
	spoilersInteractive?: boolean | undefined;
};

// Renders a review body as a sequence of paragraphs, each with spoilers and
// links inline in their original position. Replaces the old pattern of
// splitting on \n\n and rendering each paragraph independently, which is
// what made a spoiler unable to span a paragraph break in the first place.
export function ReviewBody({
	text,
	paragraphClassName,
	spoilersInteractive = true,
}: ReviewBodyProps) {
	const blocks = splitReviewBody(text, spoilersInteractive);
	return (
		<>
			{blocks.map((block) => (
				<p className={paragraphClassName} key={block.key}>
					{block.nodes}
				</p>
			))}
		</>
	);
}
