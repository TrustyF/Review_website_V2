import styles from "./credit-media-list-loading.module.sass";

// Shared by both /credits/person/[id]/loading.tsx and
// /credits/company/[id]/loading.tsx — shown while CreditMediaListPage's own
// queries (entity + every credited role's media, see
// credit-media-list-page.tsx) are still in flight, so the browser gets a
// shell immediately instead of sitting on the previous page. Mirrors
// credit-media-list-page.module.sass's own layout (photo size, header gap)
// closely enough that the swap-in doesn't jump.
export function CreditMediaListLoading() {
	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<div className={styles.photo} />
				<div className={styles.header_text}>
					<div className={`${styles.bar} ${styles.name_bar}`} />
					<div className={`${styles.bar} ${styles.rating_bar}`} />
				</div>
			</div>
			<div className={styles.role_group}>
				<div className={`${styles.bar} ${styles.role_title_bar}`} />
				<div className={styles.grid}>
					{Array.from({ length: 7 }, (_, i) => (
						<div key={i} className={styles.card} />
					))}
				</div>
			</div>
		</div>
	);
}
