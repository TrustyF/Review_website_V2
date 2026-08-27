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

// Polls rather than pushing (SSE/websocket) — this is a throwaway dev tool
// for eyeballing counts while you click around in another tab, not
// something that needs sub-second accuracy.
// Date.now() is impure, so the elapsed-seconds figure is computed once per
// poll tick (inside the effect, not render) and carried alongside the
// snapshot rather than derived fresh on every render.
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
