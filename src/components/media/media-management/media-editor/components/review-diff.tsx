import { diffWords } from "diff";
import styles from "./review-diff.module.sass";

type Props = {
	before: string;
	after: string;
	// Called with the full new body text when a change is accepted.
	onApplyChange: (newBody: string) => void;
};

// Read-only word-level diff of the AI suggestion against the current body —
// added words highlighted (click to apply just that change to the body),
// removed words hidden, unchanged text plain.
export function ReviewDiff({ before, after, onApplyChange }: Props) {
	const parts = diffWords(before, after);

	// Groups consecutive added/removed parts into single click targets, so accepting a
	// replacement (e.g. "realy" -> "really") also drops the text it replaces.
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

	// Reconstructs the body with only the given block's change applied; other pending changes are left as-is.
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
