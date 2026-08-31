"use client";
import { useEffect, useState } from "react";
import { Clickable } from "@/components/ui/clickable";
import {
	clearInvocationCounts,
	fetchInvocationCounts,
} from "./invocation-actions";
import type { InvocationSnapshot } from "@/server/dev/invocation-tracker";
import styles from "./invocations-dev.module.sass";

const POLL_INTERVAL_MS = 1500;

// Polls (no SSE/websocket needed for a throwaway dev tool). Elapsed seconds
// computed once per poll tick, not on render, since Date.now() is impure.
type Displayed = InvocationSnapshot & { elapsedSeconds: number };

function withElapsed(snapshot: InvocationSnapshot): Displayed {
	return {
		...snapshot,
		elapsedSeconds: Math.max(
			0,
			Math.round((Date.now() - snapshot.windowStartedAt) / 1000),
		),
	};
}

export function InvocationCounter() {
	const [snapshot, setSnapshot] = useState<Displayed | null>(null);

	useEffect(() => {
		let cancelled = false;
		function poll() {
			fetchInvocationCounts().then((next) => {
				if (!cancelled) setSnapshot(withElapsed(next));
			});
		}
		poll();
		const interval = setInterval(poll, POLL_INTERVAL_MS);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, []);

	async function handleReset() {
		setSnapshot(withElapsed(await clearInvocationCounts()));
	}

	if (!snapshot) return <div className={styles.loading}>Loading…</div>;

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<div className={styles.total}>
					{snapshot.total} invocation{snapshot.total === 1 ? "" : "s"}
					<span className={styles.window}>
						{" "}
						in the last {snapshot.elapsedSeconds}s
					</span>
				</div>
				<Clickable className={styles.reset} onClick={handleReset}>
					Reset
				</Clickable>
			</div>

			{snapshot.byKey.length === 0 ? (
				<div className={styles.empty}>
					Nothing recorded yet — go trigger something (e.g. open a poster/
					banner picker on a media detail page) in another tab.
				</div>
			) : (
				<table className={styles.table}>
					<tbody>
						{snapshot.byKey.map(([key, count]) => (
							<tr key={key}>
								<td className={styles.key}>{key}</td>
								<td className={styles.count}>{count}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
