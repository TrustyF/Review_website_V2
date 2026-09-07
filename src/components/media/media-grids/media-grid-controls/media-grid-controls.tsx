import { ReactNode } from "react";
import styles from "./media-grid-controls.module.sass";

type Props = {
	children: ReactNode;
	// Floats this over the wrapper's top-right corner instead of reserving its own flow row, so it
	// ignores whatever space the next sibling (e.g. a sticky group header) takes. Wrapper needs position: relative.
	overlay?: boolean;
};

// Groups the sort/filter trigger(s) into one right-aligned row. In flow by default — render as
// the caller's first flow child so nothing above it can push it around. `overlay` floats it instead.
export function MediaGridControls({ children, overlay }: Props) {
	return (
		<div className={overlay ? styles.group_overlay : styles.group}>{children}</div>
	);
}
