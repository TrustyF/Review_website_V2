import { ChartNoAxesCombined } from "lucide-react";
import { getStats } from "@/components/stats/stats-actions";
import { StatsPageClient } from "@/components/stats/stats-page-client";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./stats.module.sass";

export default async function StatsPage() {
	const [stats, dict] = await Promise.all([getStats(), getDictionary()]);

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1 className={styles.title}>
					<ChartNoAxesCombined size={20} className={styles.title_icon} />
					{dict.stats.title}
				</h1>
			</div>
			<StatsPageClient initialStats={stats} />
		</div>
	);
}
