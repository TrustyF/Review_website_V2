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
// Images split the paragraph they sit in; successive ones (only whitespace between) share one row.
type ReviewImage = { url: string; alt: string };
type ReviewBodyBlock =
	| { kind: "paragraph"; key: number; nodes: ReactNode[] }
	| { kind: "images"; key: number; images: ReviewImage[] };

function isBlank(node: ReactNode): boolean {
	return typeof node === "string" && node.trim() === "";
}

// Parses ||spoiler||, ![alt](url) and [text](url) over the entire input in one pass (rather than per-paragraph) so a spoiler can span a paragraph break.
function splitReviewBody(
	text: string,
	spoilersInteractive: boolean,
	showImages: boolean,
): ReviewBodyBlock[] {
	const blocks: ReviewBodyBlock[] = [];
	let currentNodes: ReactNode[] = [];
	let blockKey = 0;
	let inlineKey = 0;

	// A whitespace-only paragraph is dropped, so it can't separate two images either.
	function flushParagraph() {
		if (!currentNodes.every(isBlank)) {
			blocks.push({ kind: "paragraph", key: blockKey++, nodes: currentNodes });
		}
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
		} else if (match[3] !== undefined) {
			const url = match[3];
			if (!isSafeUrl(url)) {
				currentNodes.push(match[0]);
			} else if (showImages) {
				flushParagraph();
				const image = { url, alt: match[2]! };
				const last = blocks.at(-1);
				if (last?.kind === "images") last.images.push(image);
				else blocks.push({ kind: "images", key: blockKey++, images: [image] });
			}
		} else {
			const linkText = match[4]!;
			const url = match[5]!;
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
	// false for clamped excerpts, where an image would eat the whole preview.
	showImages?: boolean | undefined;
	// Replaces the default image styling, e.g. to cap height inside a clamped excerpt.
	imageClassName?: string | undefined;
};

// Renders a review body as paragraphs with spoilers/links inline in their original position.
export function ReviewBody({
	text,
	paragraphClassName,
	spoilersInteractive = true,
	showImages = true,
	imageClassName,
}: ReviewBodyProps) {
	const blocks = splitReviewBody(text, spoilersInteractive, showImages);
	const renderImage = ({ url, alt }: ReviewImage, key: number) => (
		// Plain <img>, not next/image: the host is an arbitrary pasted URL with unknown dimensions.
		// eslint-disable-next-line @next/next/no-img-element
		<img
			key={key}
			src={url}
			alt={alt}
			className={imageClassName ?? styles.image}
			loading="lazy"
		/>
	);
	return (
		<>
			{blocks.map((block) =>
				block.kind === "images" ? (
					block.images.length === 1 ? (
						renderImage(block.images[0]!, block.key)
					) : (
						<div key={block.key} className={styles.image_row}>
							{block.images.map((image, i) => renderImage(image, i))}
						</div>
					)
				) : (
					<p className={paragraphClassName} key={block.key}>
						{block.nodes}
					</p>
				),
			)}
		</>
	);
}
