import { ReactNode } from "react";
import styles from "./media-grid-controls.module.sass";

type Props = {
	children: ReactNode;
};

// Groups the sort/filter trigger(s) into one cluster, absolutely positioned over the caller's
// top-right corner — not sticky, so it scrolls away with the page like any normal content.
export function MediaGridControls({ children }: Props) {
	return <div className={styles.group}>{children}</div>;
}
