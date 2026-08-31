import Image from "next/image";
import style from "./logo-image.module.sass";

// Compact sibling of Logo/LogoSimple for the dark navbar: uses var(--foreground)/var(--brand) instead of the fixed ticket-paper/ink/accent pair so it belongs to the dark theme instead of fighting it.
export function LogoImage() {
	return (
		<div className={style.tag}>
			{/* Backs the mark's transparent interior so the navbar bg doesn't show through; ordered before .image so .image paints on top. */}
			<div className={style.fill} aria-hidden="true" />
			<Image
				src="/ui/logo.webp"
				alt=""
				width={502}
				height={172}
				className={style.image}
			/>
			{/* Mobile swaps to this square icon (no room for the wide wordmark); both stay mounted, CSS toggles display to avoid layout shift on resize. */}
			<Image
				src="/ui/icon.webp"
				alt=""
				width={60}
				height={60}
				className={style.icon}
			/>
			<div className={style.name}>
				Arthur&apos;s
				<br />
				corner
			</div>
		</div>
	);
}
