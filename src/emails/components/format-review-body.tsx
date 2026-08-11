import { Link, Text } from "@react-email/components";
import { Fragment, ReactNode } from "react";
import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";

// Mirrors review-body.tsx's ||spoiler||/[text](url) parsing, reusing the
// same regex the site itself uses (see that file's own note on why the
// regex lives in a plain, non-"use client" module) — but spoilers can't be
// click-to-reveal here since no JS runs in a mail client, so spoiler text
// is redacted instead of shown plainly.
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
				<span
					key={`${lineKey}-${partIndex++}`}
					style={{ fontStyle: "italic", color: "#666666" }}>
					[spoiler — read on the site]
				</span>,
			);
		} else if (linkText != null && linkUrl != null) {
			parts.push(
				<Link
					key={`${lineKey}-${partIndex++}`}
					href={linkUrl}
					style={{ color: "#8ab4f8" }}>
					{linkText}
				</Link>,
			);
		}

		lastIndex = REVIEW_MARKUP_REGEX.lastIndex;
	}
	if (lastIndex < line.length) {
		parts.push(
			<Fragment key={`${lineKey}-${partIndex++}`}>{line.slice(lastIndex)}</Fragment>,
		);
	}

	return parts;
}

// Same paragraph split as review.tsx's SplitLineBody (body.split("\n\n")).
export function formatReviewBody(body: string): ReactNode {
	return body.split("\n\n").map((line, index) => (
		<Text
			key={index}
			style={{
				margin: "0 0 12px",
				fontSize: "14px",
				lineHeight: "1.5",
				color: "#ededed",
			}}>
			{formatReviewLine(line, String(index))}
		</Text>
	));
}
