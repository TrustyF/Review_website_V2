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
// spoiler in the same review, permanently for this render. Still a <span>
// (a <div> here would be invalid inside the <p> a paragraph block renders
// into — see ReviewBody below), styled display: block so each spoiler
// reads as its own standalone bar rather than an inline highlight sitting
// mid-sentence.
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

// One block-level unit of a parsed review body — either a paragraph's
// worth of inline content (plain text, links, or both) or a standalone
// spoiler. Unlike a paragraph, a spoiler is allowed to span what were
// originally multiple \n\n-separated paragraphs — see splitReviewBody.
type ReviewBodyBlock =
	| { type: "paragraph"; key: number; nodes: ReactNode[] }
	| { type: "spoiler"; key: number; text: string };

// Parses ||spoiler|| and [text](url) markup over the *entire* input in one
// pass, unlike the old per-paragraph approach this replaced — REVIEW_MARKUP
// _REGEX's [\s\S] already matches across newlines, so the only reason a
// spoiler couldn't span a paragraph break before was that callers split the
// body on \n\n before any of this ever ran. Plain text between/around
// matches still gets split into separate paragraph blocks on \n\n — a
// spoiler match itself never does, even when its own captured text
// contains one, since that's exactly the case this exists to support.
function splitReviewBody(text: string): ReviewBodyBlock[] {
	const blocks: ReviewBodyBlock[] = [];
	let currentNodes: ReactNode[] = [];
	let blockKey = 0;
	let inlineKey = 0;

	function flushParagraph() {
		if (currentNodes.length === 0) return;
		blocks.push({ type: "paragraph", key: blockKey++, nodes: currentNodes });
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
			flushParagraph();
			blocks.push({ type: "spoiler", key: blockKey++, text: match[1] });
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
	// Applied to each plain-text paragraph's own <p> — a standalone spoiler
	// block isn't wrapped in one (see splitReviewBody), it's already a
	// block-level element in its own right (see review.module.sass's
	// .spoiler), so this only ever reaches actual paragraphs.
	paragraphClassName?: string | undefined;
	// Teaser truncation (e.g. featured-review.tsx's excerpt) — caps how many
	// *parsed* blocks render, each spoiler counting as exactly one
	// regardless of how many \n\n it spans internally. Deliberately not
	// "caller pre-truncates the raw text before handing it to ReviewBody":
	// truncating the raw text by \n\n count first, the way this used to
	// work, can land the cut point between a spoiler's opening and closing
	// ||, leaving an unterminated delimiter in the truncated string — the
	// regex then simply doesn't match at all, so what should've been a
	// spoiler block renders as literal "||text" instead. Truncating after
	// parsing (here) can't do that: a spoiler is already a single atomic
	// block by the time this slices, so it's either included whole or not
	// at all.
	maxBlocks?: number | undefined;
	// Passed straight through to every spoiler block — see SpoilerText's own
	// comment on what false does and why (featured-review.tsx's hero excerpt
	// is the one caller that needs it: that whole card is already a Link to
	// the review page, so a spoiler's own click-to-reveal has to get out of
	// the way rather than fight that navigation).
	spoilersInteractive?: boolean | undefined;
};

// Renders a review body (or however much of one a caller wants — see
// maxBlocks above) as a sequence of paragraphs and standalone spoiler
// blocks, in original order. Replaces the old pattern of splitting on \n\n
// and rendering each paragraph independently, which is what made a spoiler
// unable to span a paragraph break in the first place.
export function ReviewBody({
	text,
	paragraphClassName,
	maxBlocks,
	spoilersInteractive = true,
}: ReviewBodyProps) {
	const allBlocks = splitReviewBody(text);
	const blocks =
		maxBlocks === undefined ? allBlocks : allBlocks.slice(0, maxBlocks);
	return (
		<>
			{blocks.map((block) =>
				block.type === "spoiler" ? (
					<SpoilerText key={block.key} interactive={spoilersInteractive}>
						{block.text}
					</SpoilerText>
				) : (
					<p className={paragraphClassName} key={block.key}>
						{block.nodes}
					</p>
				),
			)}
		</>
	);
}
