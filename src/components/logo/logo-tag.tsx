import style from "./logo-tag.module.sass";

// Compact sibling of Logo/LogoSimple for dark navbar chrome: no white ticket-paper card,
// just var(--foreground) border/text so it belongs to the dark theme. Uses var(--brand), not --ticket-accent.
export function LogoTag() {
	return (
		<div className={style.tag}>
			<div className={style.name}>
				Arthur&apos;s
				<br />
				corner
				{/*<div className={style.dotted}></div>*/}
			</div>
			<div className={style.mark}></div>
			<div className={style.border}></div>
		</div>
	);
}
