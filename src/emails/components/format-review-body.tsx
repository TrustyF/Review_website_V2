import { Link, Text } from "@react-email/components";
import { Fragment, ReactNode } from "react";
import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";

// Mirrors review-body.tsx's ||spoiler||/[text](url) parsing, but redacts
// spoilers since no JS runs in a mail client for click-to-reveal.
function formatReviewLine(line: string, lineKey: string): ReactNode {
	const parts: ReactNode[] = [];
	let lastIndex = 0;
	let partIndex = 0;
	REVIEW_MARKUP_REGEX.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = REVIEW_MARKUP_REGEX.exec(line))) {
		if (match.index > lastIndex) {
			parts.push(
				<Fragment key={`${lineKey}-${partIndex++}`}>
					{line.slice(lastIndex, match.index)}
				</Fragment>,
			);
		}

		const [, spoilerText, linkText, linkUrl] = match;
		if (spoilerText != null) {
			parts.push(
				<span key={`${lineKey}-${partIndex++}`} className="italic text-fg-3">
					[spoiler — read on the site]
				</span>,
			);
		} else if (linkText != null && linkUrl != null) {
			parts.push(
				<Link
					key={`${lineKey}-${partIndex++}`}
					href={linkUrl}
					className="text-link underline">
					{linkText}
				</Link>,
			);
		}

		lastIndex = REVIEW_MARKUP_REGEX.lastIndex;
	}
	if (lastIndex < line.length) {
		parts.push(
			<Fragment key={`${lineKey}-${partIndex++}`}>
				{line.slice(lastIndex)}
			</Fragment>,
		);
	}

	return parts;
}

// Roughly matches featured-review.module.sass's 9rem/~4-line CSS clamp, but
// as a character budget instead — email has no reliable max-height/overflow
// clipping (Outlook's Word engine ignores it outright), so the cut has to
// happen in the text itself before it ever reaches the markup.
const MAX_BODY_CHARS = 420;

// Drops whole trailing paragraphs once the budget is spent — never slices
// inside one, so a ||spoiler|| or [text](url) token can never end up cut
// in half by the truncation itself.
function truncateParagraphs(paragraphs: string[]): {
	shown: string[];
	truncated: boolean;
} {
	let used = 0;
	const shown: string[] = [];
	for (const [i, paragraph] of paragraphs.entries()) {
		if (i > 0 && used + paragraph.length > MAX_BODY_CHARS) {
			return { shown, truncated: true };
		}
		shown.push(paragraph);
		used += paragraph.length;
	}
	return { shown, truncated: false };
}

// Same paragraph split as review.tsx's SplitLineBody. Uses fg-2 (email
// counterpart to review.module.sass's var(--body)), not fg — review text is
// intentionally a notch dimmer than titles/headings on the site.
export function formatReviewBody(body: string, readMoreUrl: string): ReactNode {
	const { shown, truncated } = truncateParagraphs(body.split("\n\n"));
	return (
		<>
			{shown.map((line, index) => (
				<Text
					key={index}
					className="m-0 mb-3 text-[14px] leading-[1.5] text-fg-2">
					{formatReviewLine(line, String(index))}
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
