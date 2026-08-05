import { diffWords } from "diff";
import styles from "./review-diff.module.sass";

type Props = {
	before: string;
	after: string;
	// Called with the full new body text when a change is accepted — the
	// caller is expected to patch the real body field with it.
	onApplyChange: (newBody: string) => void;
};

// Read-only word-level diff of the AI suggestion against the current body —
// added words highlighted (click to apply just that change to the body),
// removed words hidden, unchanged text plain.
export function ReviewDiff({ before, after, onApplyChange }: Props) {
	const parts = diffWords(before, after);

	// Group consecutive added/removed parts into single click targets — a
	// word-level diff usually pairs a removed run with an added run for a
	// replacement (e.g. "realy" -> "really"), and accepting the addition
	// should also drop the text it's replacing, not just insert alongside it.
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
		} else {
			inBlock = false;
		}
	});

	// Reconstructs the body with only the given block's change applied —
	// every other pending change is left exactly as it currently is in the
	// body (its removed text is kept, its added text is left out).
	function applyBlock(blockIndex: number) {
		let result = "";
		parts.forEach((part, i) => {
			if (!part.added && !part.removed) {
				result += part.value;
				return;
			}
			const accepted = blockOfPart[i] === blockIndex;
			if (part.added && accepted) result += part.value;
			if (part.removed && !accepted) result += part.value;
		});
		onApplyChange(result);
	}

	return (
		<div className={styles.wrapper}>
			{parts.map((part, i) => {
				if (part.added) {
					const blockIndex = blockOfPart[i]!;
					return (
						<span
							key={i}
							className={styles.added}
							role="button"
							tabIndex={0}
							title="Click to apply this change to the body"
							onClick={() => applyBlock(blockIndex)}
							onKeyDown={(e) => {
								if (e.key !== "Enter" && e.key !== " ") return;
								e.preventDefault();
								applyBlock(blockIndex);
							}}
						>
							{part.value}
						</span>
					);
				}
				if (part.removed) return null;
				return <span key={i}>{part.value}</span>;
			})}
		</div>
	);
}
