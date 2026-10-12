import { diffWordsWithSpace } from "diff";
import styles from "./review-diff.module.sass";

type Props = {
	before: string;
	after: string;
	// Called with the full new body text when a change is accepted.
	onApplyChange: (newBody: string) => void;
};

const WHITESPACE_ONLY = /^\s+$/;

// Makes a whitespace-only change visible; added newlines still break the line.
function showWhitespace(value: string, added: boolean): string {
	return value.replace(/\n/g, added ? "↵\n" : "↵").replace(/[ \t]/g, "·");
}

// Word-level diff: added and removed both clickable. WithSpace, since plain diffWords takes
// unchanged whitespace from `after`, which fused words when rebuilding `before`.
export function ReviewDiff({ before, after, onApplyChange }: Props) {
	const parts = diffWordsWithSpace(before, after);

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
					? showWhitespace(part.value, !!part.added)
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
