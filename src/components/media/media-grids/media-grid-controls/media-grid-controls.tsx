import { ReactNode } from "react";
import styles from "./media-grid-controls.module.sass";

type Props = {
	children: ReactNode;
};

// Groups the sort/filter trigger(s) into one right-aligned row, in normal flow above the grid.
// Caller's wrapper must be a flex column with a gap, and this must be its first child.
export function MediaGridControls({ children }: Props) {
	return <div className={styles.group}>{children}</div>;
}
