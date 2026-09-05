import { Link, Text } from "@react-email/components";
import { Fragment, ReactNode } from "react";
import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";

// Mirrors review-body.tsx's ||spoiler||/[text](url) parsing, but redacts
// spoilers since no JS runs in a mail client for click-to-reveal.
type Atom =
	| { kind: "word"; text: string }
	| { kind: "para-break" }
	| { kind: "spoiler" }
	| { kind: "link"; text: string; url: string };

function pushWords(atoms: Atom[], text: string): void {
	for (const word of text.split(/\s+/).filter(Boolean)) {
		atoms.push({ kind: "word", text: word });
	}
}

// Splits the body into words plus spoiler/link tokens (each an indivisible
// atom), with paragraph breaks kept as their own atom — lets truncation cut
// off anywhere, including mid-paragraph, without ever slicing a token in half.
function tokenizeBody(body: string): Atom[] {
	const atoms: Atom[] = [];
	const paragraphs = body.split("\n\n");

	for (const [pIndex, paragraph] of paragraphs.entries()) {
		if (pIndex > 0) atoms.push({ kind: "para-break" });

		REVIEW_MARKUP_REGEX.lastIndex = 0;
		let lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = REVIEW_MARKUP_REGEX.exec(paragraph))) {
			if (match.index > lastIndex) {
				pushWords(atoms, paragraph.slice(lastIndex, match.index));
			}

			const [, spoilerText, linkText, linkUrl] = match;
			if (spoilerText != null) {
				atoms.push({ kind: "spoiler" });
			} else if (linkText != null && linkUrl != null) {
				atoms.push({ kind: "link", text: linkText, url: linkUrl });
			}

			lastIndex = REVIEW_MARKUP_REGEX.lastIndex;
		}
		if (lastIndex < paragraph.length) {
			pushWords(atoms, paragraph.slice(lastIndex));
		}
	}

	return atoms;
}

// Roughly matches featured-review.module.sass's 9rem/~4-line CSS clamp, but
// as a word budget instead — email has no reliable max-height/overflow
// clipping (Outlook's Word engine ignores it outright), so the cut has to
// happen in the text itself before it ever reaches the markup. A spoiler or
// link token counts as a single word toward the budget.
const MAX_BODY_WORDS = 60;

function truncateAtoms(atoms: Atom[]): { shown: Atom[]; truncated: boolean } {
	let used = 0;
	const shown: Atom[] = [];
	for (const atom of atoms) {
		if (atom.kind === "para-break") {
			shown.push(atom);
			continue;
		}
		if (used >= MAX_BODY_WORDS) {
			return { shown, truncated: true };
		}
		shown.push(atom);
		used++;
	}
	return { shown, truncated: false };
}

function renderParagraphAtoms(atoms: Atom[], paraKey: string): ReactNode {
	const nodes: ReactNode[] = [];
	atoms.forEach((atom, i) => {
		if (i > 0) nodes.push(" ");
		if (atom.kind === "word") {
			nodes.push(<Fragment key={`${paraKey}-${i}`}>{atom.text}</Fragment>);
		} else if (atom.kind === "spoiler") {
			nodes.push(
				<span key={`${paraKey}-${i}`} className="italic text-fg-3">
					*spoiler*
				</span>,
			);
		} else if (atom.kind === "link") {
			nodes.push(
				<Link
					key={`${paraKey}-${i}`}
					href={atom.url}
					className="text-link underline">
					{atom.text}
				</Link>,
			);
		}
	});
	return nodes;
}

// Same paragraph split as review.tsx's SplitLineBody. Uses fg-2 (email
// counterpart to review.module.sass's var(--body)), not fg — review text is
// intentionally a notch dimmer than titles/headings on the site.
export function formatReviewBody(body: string, readMoreUrl: string): ReactNode {
	const { shown, truncated } = truncateAtoms(tokenizeBody(body));

	let currentParagraph: Atom[] = [];
	const paragraphs: Atom[][] = [currentParagraph];
	for (const atom of shown) {
		if (atom.kind === "para-break") {
			currentParagraph = [];
			paragraphs.push(currentParagraph);
		} else {
			currentParagraph.push(atom);
		}
	}
	// A cut landing exactly on a para-break leaves a trailing empty paragraph.
	const visibleParagraphs = paragraphs.filter((atoms) => atoms.length > 0);

	return (
		<>
			{visibleParagraphs.map((atoms, index) => (
				<Text
					key={index}
					className="m-0 mb-3 text-[14px] leading-[1.5] text-fg-2">
					{renderParagraphAtoms(atoms, String(index))}
					{truncated && index === visibleParagraphs.length - 1 && "..."}
				</Text>
			))}
			{truncated && (
				<Link
					href={readMoreUrl}
					className="text-[13px] font-semibold text-brand no-underline">
					Read full review →
				</Link>
			)}
		</>
	);
}
