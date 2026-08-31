import style from "./logo-simple.module.sass";

// Pared-back sibling of Logo: same ticket-stub premise minus the perforation, meta row, and stub mark. Its own component since little markup remains shared once those drop out.
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
