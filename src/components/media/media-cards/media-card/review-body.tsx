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

// Shared "has any spoiler been clicked" flag, scoped per-review so revealing one review's spoilers doesn't touch another's.
const SpoilerRevealContext = createContext<{
	revealed: boolean;
	reveal: () => void;
}>({ revealed: false, reveal: () => {} });

// Wrap a whole review body in this once — every SpoilerText inside shares the one flag it provides.
export function ReviewSpoilerProvider({ children }: { children: ReactNode }) {
	const [revealed, setRevealed] = useState(false);
	return (
		<SpoilerRevealContext.Provider
			value={{ revealed, reveal: () => setRevealed(true) }}>
			{children}
		</SpoilerRevealContext.Provider>
	);
}

// Accessible name for the unrevealed state — there's no visible on-screen label.
const SPOILER_LABEL = "Spoilers, click to reveal";

// Click or Enter/Space reveals this and every other spoiler in the review.
// interactive=false (used when nested in a navigating ancestor <Link>, e.g. featured-review.tsx) drops all handlers/role so a click just bubbles up to the link instead of fighting its navigation.
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

// A paragraph's worth of inline content, split apart only on \n\n; a spoiler never forces its own paragraph break even if its captured text contains \n\n.
type ReviewBodyBlock = { key: number; nodes: ReactNode[] };

// Parses ||spoiler|| and [text](url) over the entire input in one pass (rather than per-paragraph) so a spoiler can span a paragraph break.
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
				// Unsafe scheme (e.g. javascript:) — render as plain text instead.
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
	// Applied to each paragraph's <p>; never reaches a spoiler directly since those render inline.
	paragraphClassName?: string | undefined;
	// Passed through to every spoiler — see SpoilerText's interactive param.
	spoilersInteractive?: boolean | undefined;
};

// Renders a review body as paragraphs with spoilers/links inline in their original position.
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
