import style from "./logo-simple.module.sass";

// A pared-back sibling of Logo (see logo.tsx) — same ticket-stub premise
// (paper card, admit-one header, "arthur's corner" wordmark, red stub
// panel) but without the perforated margin, the seat/showing/host line, or
// the "a" stub mark — just a stacked ticket number instead. Kept as its own
// component rather than a variant of Logo since the two no longer share
// much markup once the perforation/meta row drop out.
export function LogoSimple() {
	return (
		<div className={style.ticket}>
			<div className={style.body}>
				<span className={style.header}>Admit one</span>
				<div className={style.title}>
					arthur&apos;s
					<br />
					corner
				</div>
			</div>

			<div className={style.stub}>
				<span className={style.number}>0</span>
				<span className={style.number}>0</span>
				<span className={style.number}>1</span>
			</div>
		</div>
	);
}
