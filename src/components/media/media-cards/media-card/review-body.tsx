"use client";
import {
	createContext,
	type CSSProperties,
	Fragment,
	type KeyboardEvent as ReactKeyboardEvent,
	ReactNode,
	useContext,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	parseImageSize,
	REVIEW_MARKUP_REGEX,
} from "@/components/media/media-cards/media-card/review-body-syntax";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import { useShowSpoilers } from "@/lib/spoilers/show-spoilers-context";
import { EyeOff } from "lucide-react";
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

// Explains the redaction bars, which readers didn't recognize as clickable. Fallback for when the
// in-bar overlay (see SpoilerText) has no line wide enough; sits above the first spoiler's paragraph.
function SpoilerNotice() {
	const { revealed, reveal } = useContext(SpoilerRevealContext);
	const dict = useDictionary();
	const alwaysShow = useShowSpoilers();
	if (revealed || alwaysShow) return null;
	return (
		<div className={styles.spoiler_notice}>
			<EyeOff size={14} aria-hidden="true" />
			<span>{dict.media.spoilerNotice}</span>
			<Clickable className={styles.spoiler_notice_reveal} onClick={reveal}>
				{dict.media.spoilerRevealAll}
			</Clickable>
		</div>
	);
}

// How far below the spoiler's top edge the notice box sits.
const OVERLAY_TOP_OFFSET_PX = 8;

// Click/Enter/Space reveals every spoiler in the review. interactive=false (inside a navigating <Link>, e.g. featured-review.tsx) drops handlers so clicks reach the link.
// onNoticeFit (first spoiler only): notice box centered over the bar, no shift on reveal; false = bar too narrow, ReviewBody falls back.
function SpoilerText({
	children,
	interactive = true,
	onNoticeFit,
}: {
	children: string;
	interactive?: boolean;
	onNoticeFit?: ((fits: boolean) => void) | undefined;
}) {
	const { revealed, reveal } = useContext(SpoilerRevealContext);
	const dict = useDictionary();
	// The "never hide spoilers" account setting shows them as plain text, even where they aren't clickable.
	const alwaysShow = useShowSpoilers();
	const clickable = interactive && !alwaysShow;
	const isRevealed = alwaysShow || (interactive && revealed);
	const showOverlay = onNoticeFit !== undefined && clickable && !revealed;

	const textRef = useRef<HTMLSpanElement>(null);
	const overlayRef = useRef<HTMLSpanElement>(null);
	const [placement, setPlacement] = useState<CSSProperties | null>(null);

	useLayoutEffect(() => {
		const text = textRef.current;
		const overlay = overlayRef.current;
		if (!showOverlay || !text || !overlay) return;
		// Centers the box horizontally on the spoiler's bounding block (all its line rects), just below its
		// top, against offsetParent (the paragraph). Too narrow a block (a short one-liner) falls back instead.
		const measure = () => {
			const parent = overlay.offsetParent;
			if (!parent) return;
			const lines = Array.from(text.getClientRects()).filter(
				(rect) => rect.width > 0,
			);
			const left = Math.min(...lines.map((rect) => rect.left));
			const right = Math.max(...lines.map((rect) => rect.right));
			if (!lines.length || right - left < overlay.offsetWidth) {
				setPlacement(null);
				onNoticeFit(false);
				return;
			}
			const box = parent.getBoundingClientRect();
			setPlacement({
				left: (left + right) / 2 - box.left - parent.clientLeft,
				top: lines[0]!.top - box.top - parent.clientTop + OVERLAY_TOP_OFFSET_PX,
			});
			onNoticeFit(true);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(overlay.offsetParent ?? text);
		return () => observer.disconnect();
	}, [showOverlay, onNoticeFit, children]);

	return (
		<span
			className={`${styles.spoiler} ${isRevealed ? styles.spoiler_revealed : ""}`}
			role={clickable ? "button" : undefined}
			tabIndex={clickable ? 0 : undefined}
			aria-label={
				clickable && !isRevealed ? dict.media.spoilerLabel : undefined
			}
			onClick={clickable && !isRevealed ? reveal : undefined}
			onKeyDown={
				clickable
					? (e: ReactKeyboardEvent) => {
							if (isRevealed || (e.key !== "Enter" && e.key !== " ")) return;
							e.preventDefault();
							reveal();
						}
					: undefined
			}>
			<span ref={textRef} className={styles.spoiler_text}>
				{children}
			</span>
			{/* A DOM child of the spoiler, so clicking it bubbles to the spoiler's reveal. */}
			{showOverlay && (
				<span
					ref={overlayRef}
					className={styles.spoiler_overlay}
					style={placement ?? undefined}
					data-placed={placement ? "" : undefined}
					aria-hidden="true">
					<EyeOff size={13} />
					{dict.media.spoilerOverlay}
				</span>
			)}
		</span>
	);
}

// A paragraph's worth of inline content, split apart only on \n\n; a spoiler never forces its own paragraph break even if its captured text contains \n\n.
// Images and spacers split the paragraph they sit in; successive images (only whitespace between) share one row.
type ReviewImage = {
	url: string;
	alt: string;
	size: ReturnType<typeof parseImageSize>;
};
type ReviewBodyBlock =
	| { kind: "paragraph"; key: number; nodes: ReactNode[]; hasSpoiler: boolean }
	| { kind: "images"; key: number; images: ReviewImage[] }
	| { kind: "spacer"; key: number; height: string | undefined };

function isBlank(node: ReactNode): boolean {
	return typeof node === "string" && node.trim() === "";
}

// Parses ||spoiler||, ![alt](url), [text](url) and [spacer] over the entire input in one pass (rather than per-paragraph) so a spoiler can span a paragraph break.
function splitReviewBody(
	text: string,
	spoilersInteractive: boolean,
	showImages: boolean,
	onNoticeFit: ((fits: boolean) => void) | undefined,
): ReviewBodyBlock[] {
	const blocks: ReviewBodyBlock[] = [];
	let currentNodes: ReactNode[] = [];
	let currentHasSpoiler = false;
	let blockKey = 0;
	let inlineKey = 0;

	// A whitespace-only paragraph is dropped, so it can't separate two images either.
	function flushParagraph() {
		if (!currentNodes.every(isBlank)) {
			blocks.push({
				kind: "paragraph",
				key: blockKey++,
				nodes: currentNodes,
				hasSpoiler: currentHasSpoiler,
			});
		}
		currentNodes = [];
		currentHasSpoiler = false;
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
			const isFirstSpoiler =
				!blocks.some(
					(block) => block.kind === "paragraph" && block.hasSpoiler,
				) && !currentHasSpoiler;
			currentHasSpoiler = true;
			currentNodes.push(
				<SpoilerText
					key={inlineKey++}
					interactive={spoilersInteractive}
					onNoticeFit={isFirstSpoiler ? onNoticeFit : undefined}>
					{match[1]}
				</SpoilerText>,
			);
		} else if (match[3] !== undefined) {
			const url = match[3];
			if (!isSafeUrl(url)) {
				currentNodes.push(match[0]);
			} else if (showImages) {
				flushParagraph();
				const image = { url, alt: match[2]!, size: parseImageSize(match[4]) };
				const last = blocks.at(-1);
				if (last?.kind === "images") last.images.push(image);
				else blocks.push({ kind: "images", key: blockKey++, images: [image] });
			}
		} else if (match[7] !== undefined) {
			// Layout only, so dropped along with images where those are hidden.
			if (showImages) {
				flushParagraph();
				blocks.push({
					kind: "spacer",
					key: blockKey++,
					height: match[8] && `${match[8]}px`,
				});
			}
		} else {
			const linkText = match[5]!;
			const url = match[6]!;
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
	// Explains the first spoiler: in-bar overlay, else SpoilerNotice above its paragraph. Needs a ReviewSpoilerProvider.
	spoilerNotice?: boolean | undefined;
};

// Renders a review body as paragraphs with spoilers/links inline in their original position.
export function ReviewBody({
	text,
	paragraphClassName,
	spoilersInteractive = true,
	showImages = true,
	imageClassName,
	spoilerNotice = false,
}: ReviewBodyProps) {
	// null until measured; only false (no bar line wide enough) shows the above-paragraph notice.
	const [overlayFits, setOverlayFits] = useState<boolean | null>(null);
	const blocks = splitReviewBody(
		text,
		spoilersInteractive,
		showImages,
		spoilerNotice ? setOverlayFits : undefined,
	);
	const noticeBlockKey =
		spoilerNotice && overlayFits === false
			? blocks.find((block) => block.kind === "paragraph" && block.hasSpoiler)
					?.key
			: undefined;
	const renderImage = ({ url, alt, size }: ReviewImage, key: number) => (
		// Plain <img>, not next/image: the host is an arbitrary pasted URL with unknown dimensions.
		// eslint-disable-next-line @next/next/no-img-element
		<img
			key={key}
			src={url}
			alt={alt}
			className={imageClassName ?? styles.image}
			style={size}
			loading="lazy"
		/>
	);
	return (
		<>
			{blocks.map((block) =>
				block.kind === "spacer" ? (
					<div
						key={block.key}
						className={styles.spacer}
						style={block.height ? { height: block.height } : undefined}
						aria-hidden="true"
					/>
				) : block.kind === "images" ? (
					block.images.length === 1 ? (
						renderImage(block.images[0]!, block.key)
					) : (
						<div key={block.key} className={styles.image_row}>
							{block.images.map((image, i) => renderImage(image, i))}
						</div>
					)
				) : (
					<Fragment key={block.key}>
						{block.key === noticeBlockKey && <SpoilerNotice />}
						<p className={paragraphClassName}>{block.nodes}</p>
					</Fragment>
				),
			)}
		</>
	);
}
