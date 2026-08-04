import Link from "next/link";
import style from "./nav-bar.module.sass";

const isDev = process.env.NODE_ENV === "development";

export default function Navbar() {
	return (
		<nav className={style.wrapper}>
			<Link
				href="/"
				className={style.title}
			>
				Review app
			</Link>
			<Link
				href="/"
				className={style.link}
			>
				Home
			</Link>
			<Link
				href="/movies"
				className={style.link}
			>
				Movies
			</Link>
			<Link
				href="/shorts"
				className={style.link}
			>
				Shorts
			</Link>
			<Link
				href="/tv"
				className={style.link}
			>
				TV
			</Link>
			<Link
				href="/manga"
				className={style.link}
			>
				Manga
			</Link>
			<Link
				href="/games"
				className={style.link}
			>
				Games
			</Link>
			<Link
				href="/comics"
				className={style.link}
			>
				Comics
			</Link>
			<Link
				href="/add"
				className={style.link}
			>
				Add
			</Link>

			{isDev && (
				<details className={style.dev}>
					<summary className={style.dev_summary}>Dev</summary>
					<div className={style.dev_menu}>
						<Link
							href="/dev/media-cards"
							className={style.link}
						>
							Media cards
						</Link>
						<Link
							href="/dev/gauges"
							className={style.link}
						>
							Gauges
						</Link>
					</div>
				</details>
			)}
		</nav>
	);
}
