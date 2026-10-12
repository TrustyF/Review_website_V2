import { diffArrays } from "diff";
import styles from "./review-diff.module.sass";

type Props = {
	before: string;
	after: string;
	// Called with the full new body text when a change is accepted.
	onApplyChange: (newBody: string) => void;
};

type Part = { value: string; added?: boolean; removed?: boolean };

const WHITESPACE_ONLY = /^\s+$/;

// Words, whitespace runs and punctuation each become a token; apostrophes stay inside words.
function tokenize(text: string): string[] {
	return text.split(/(\s+|[^\p{L}\p{N}\s'’]+)/u).filter(Boolean);
}

// Line breaks are never corrected: whitespace with a line break on either side counts as unchanged.
function sameToken(a: string, b: string): boolean {
	if (a === b) return true;
	return (
		WHITESPACE_ONLY.test(a) &&
		WHITESPACE_ONLY.test(b) &&
		(a.includes("\n") || b.includes("\n"))
	);
}

// Unchanged parts are rebuilt from `before`'s own tokens, so applying a change never touches
// the rest of the body (plain diffWords took them from `after`, which fused words).
function diffKeepingLineBreaks(before: string, after: string): Part[] {
	const beforeTokens = tokenize(before);
	const changes = diffArrays(beforeTokens, tokenize(after), {
		comparator: sameToken,
	});
	let beforeIndex = 0;
	return changes.map((change) => {
		if (change.added) return { value: change.value.join(""), added: true };
		const value = beforeTokens
			.slice(beforeIndex, beforeIndex + change.value.length)
			.join("");
		beforeIndex += change.value.length;
		return change.removed ? { value, removed: true } : { value };
	});
}

// Makes a whitespace-only change visible (never a line break — those are never changes).
function showWhitespace(value: string): string {
	return value.replace(/\s/g, "·");
}

// Word-level diff: added and removed both clickable, unchanged plain.
export function ReviewDiff({ before, after, onApplyChange }: Props) {
	const parts = diffKeepingLineBreaks(before, after);

	// Groups a run of changes into one click target, so accepting a replacement also drops the
	// text it replaces. Whitespace between changes joins the run ("-a +x = -b +y" is one edit).
	const blockOfPart: (number | null)[] = new Array(parts.length).fill(null);
	let blockCount = 0;
	let inBlock = false;
	parts.forEach((part, i) => {
		if (part.added || part.removed) {
			if (!inBlock) {
				blockCount++;
				inBlock = true;
			}
			blockOfPart[i] = blockCount - 1;
		} else if (!WHITESPACE_ONLY.test(part.value)) {
			inBlock = false;
		}
	});

	// Rebuilds the body with only the given block's change applied; other pending changes are left as-is.
	function applyBlock(blockIndex: number) {
		let result = "";
		parts.forEach((part, i) => {
			const accepted = blockOfPart[i] === blockIndex;
			if (part.added ? accepted : !part.removed || !accepted) {
				result += part.value;
			}
		});
		onApplyChange(result);
	}

	return (
		<div className={styles.wrapper}>
			{parts.map((part, i) => {
				if (!part.added && !part.removed) {
					return <span key={i}>{part.value}</span>;
				}
				const blockIndex = blockOfPart[i]!;
				const text = WHITESPACE_ONLY.test(part.value)
					? showWhitespace(part.value)
					: part.value;
				return (
					<span
						key={i}
						className={part.added ? styles.added : styles.removed}
						role="button"
						tabIndex={0}
						title="Click to apply this change to the body"
						onClick={() => applyBlock(blockIndex)}
						onKeyDown={(e) => {
							if (e.key !== "Enter" && e.key !== " ") return;
							e.preventDefault();
							applyBlock(blockIndex);
						}}>
						{text}
					</span>
				);
			})}
		</div>
	);
}
