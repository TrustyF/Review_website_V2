import style from "./logo.module.sass";

const PERFORATIONS = Array.from({ length: 8 });

// The site's brand mark — a movie-ticket stub. Deliberately not theme-aware
// (--ticket-paper/--ticket-ink in globals.sass); it reads as a printed ticket.

// `compact` scales the whole mark down for the navbar's title slot, which
// doesn't have room for the full-size card.
export function Logo({ compact = false }: { compact?: boolean }) {
	return (
		<div className={`${style.ticket} ${compact ? style.compact : ""}`}>
			<div className={style.perforation}>
				{PERFORATIONS.map((_, i) => (
					<span key={i} className={style.hole} />
				))}
			</div>

			<div className={style.body}>
				<div className={style.header}>
					<span>Admit one</span>
					<span>No. 001</span>
				</div>

				<div className={style.title}>
					arthur&apos;s
					<br />
					corner
				</div>

				<div className={style.meta}>
					<div className={style.meta_item}>
						<span className={style.meta_label}>Seat</span>
						<span className={style.meta_value}>Sofa</span>
					</div>
					<div className={style.meta_item}>
						<span className={style.meta_label}>Showing</span>
						<span className={style.meta_value}>Whatever i liked</span>
					</div>
					<div className={style.meta_item}>
						<span className={style.meta_label}>Host</span>
						<span className={style.meta_value}>Just me</span>
					</div>
				</div>
			</div>

			<div className={style.stub}>
				<span className={style.stub_mark}>a</span>
				<span className={style.stub_label}>Stub</span>
			</div>
		</div>
	);
}
