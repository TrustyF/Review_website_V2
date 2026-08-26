import style from "./logo-tag.module.sass";

// The compact sibling of Logo/LogoSimple (see those files) — no ticket
// paper of its own, just a bordered tag sitting straight on whatever
// background it's placed on. Built for the dark navbar chrome those two
// aren't: their white card reads as a printed ticket against any
// background, which is the point on a page, but fighting that same white
// card against the navbar's own dark background is what this sidesteps —
// border and text use var(--foreground) rather than the fixed
// --ticket-paper/--ticket-ink pair, so it belongs to the dark theme instead
// of sitting on top of it.
export function LogoTag() {
	return (
		<div className={style.tag}>
			<div className={style.name}>
				arthur&apos;s
				<br />
				corner
			</div>
			<div className={style.mark}>a</div>
		</div>
	);
}
