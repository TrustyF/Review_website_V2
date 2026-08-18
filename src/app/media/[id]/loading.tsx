import styles from "./loading.module.sass";

// Shown by Next while page.tsx's Promise.all (media + lists + watchlist) is
// still in flight — without this, the browser sits on the previous page
// (or a blank tab) until every one of those round trips resolves. Mirrors
// media-detail.module.sass's own layout (poster_column width, header gap,
// details_wrapper spacing) closely enough that the swap-in doesn't jump.
export default function MediaDetailLoading() {
	return (
		<div className={styles.wrapper}>
			<div className={styles.no_banner_spacer} />
			<div className={styles.details_wrapper}>
				<div className={styles.header}>
					<div className={styles.poster} />
					<div className={styles.header_info}>
						<div className={`${styles.bar} ${styles.title_bar}`} />
						<div className={`${styles.bar} ${styles.meta_bar}`} />
						<div className={`${styles.bar} ${styles.review_bar}`} />
					</div>
				</div>
				<div className={styles.section}>
					<div className={`${styles.bar} ${styles.section_title_bar}`} />
					<div className={`${styles.bar} ${styles.line_bar}`} />
					<div className={`${styles.bar} ${styles.line_bar_short}`} />
				</div>
			</div>
		</div>
	);
}
