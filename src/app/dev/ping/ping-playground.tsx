"use client";
import { useState } from "react";
import { ping } from "./ping-actions";
import { Clickable } from "@/components/ui/clickable";

type Result = { query: string; ms: number };

// See ping-actions.ts's own comment — this exists purely to compare against
// a real server action's network-tab time. Temporary.
export function PingPlayground() {
	const [results, setResults] = useState<Result[]>([]);
	const [isPending, setIsPending] = useState(false);

	async function handlePing() {
		setIsPending(true);
		const startedAt = performance.now();
		await ping();
		const ms = Math.round(performance.now() - startedAt);
		setResults((prev) => [{ query: new Date().toLocaleTimeString(), ms }, ...prev].slice(0, 10));
		setIsPending(false);
	}

	return (
		<div style={{ padding: 24, maxWidth: 480, fontFamily: "monospace" }}>
			<h1 style={{ fontSize: 18, marginBottom: 8 }}>Ping (no-op server action)</h1>
			<p style={{ opacity: 0.7, marginBottom: 16 }}>
				Does zero work server-side. Click, then check this request in the
				Network tab alongside a real search request — same round-trip time
				means the cost is framework/cold-start overhead, not application code.
			</p>
			<Clickable
				disabled={isPending}
				onClick={handlePing}
				style={{
					padding: "8px 16px",
					cursor: "pointer",
					display: "inline-block",
					border: "1px solid currentColor",
					borderRadius: 4,
				}}>
				{isPending ? "Pinging…" : "Ping"}
			</Clickable>
			<ul style={{ marginTop: 16, listStyle: "none", padding: 0 }}>
				{results.map((r, i) => (
					<li key={i}>
						{r.query} — {r.ms}ms (client-measured round trip)
					</li>
				))}
			</ul>
		</div>
	);
}
