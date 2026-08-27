import Image from "next/image";
import style from "./logo-image.module.sass";

// The compact sibling of Logo/LogoSimple (see those files) — no ticket
// paper of its own, just a bordered tag sitting straight on whatever
// background it's placed on. Built for the dark navbar chrome those two
// aren't: their white card reads as a printed ticket against any
// background, which is the point on a page, but fighting that same white
// card against the navbar's own dark background is what this sidesteps —
// border and text use var(--foreground) rather than the fixed
// --ticket-paper/--ticket-ink pair, so it belongs to the dark theme instead
// of sitting on top of it. The mark uses the site's own var(--brand) rather
// than --ticket-accent, so this reads as this site's mark, not a color
// borrowed from the separate printed-ticket motif.
export function LogoImage() {
	return (
		<div className={style.tag}>
			{/* The ticket mark's own body (left of its dotted perforation) is
			    transparent art — this sits behind it, clipped to just that
			    blank interior, so the ticket reads as filled rather than
			    showing the navbar background through it. Comes before .image
			    in source order (and neither sets z-index) so .image still
			    paints on top of it. */}
			<div className={style.fill} aria-hidden="true" />
			<Image
				src="/ui/logo.webp?v=1"
				alt=""
				width={502}
				height={172}
				className={style.image}
			/>
			<div className={style.name}>
				Arthur&apos;s
				<br />
				corner
			</div>
		</div>
	);
}
