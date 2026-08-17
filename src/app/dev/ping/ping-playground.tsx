"use client";
import { useState } from "react";
import { ping } from "./ping-actions";
import { searchAllMedia } from "@/components/search/search-actions";
import { Clickable } from "@/components/ui/clickable";

type Result = { label: string; ms: number };

// See ping-actions.ts's own comment. The search button here calls the exact
// same searchAllMedia() the navbar's NavSearch does — the only difference is
// which page hosts it. NavSearch is mounted in the root layout, so its
// action POSTs to whatever real page the user is currently on; this page is
// deliberately minimal. If searchAllMedia is fast from here but stays slow
// from NavSearch, the extra cost belongs to whichever page hosts the real
// search box (its own route bundle weight), not searchAllMedia's own code —
// a much narrower, more useful thing to know than another guess at an
// import. Temporary.
export function PingPlayground() {
	const [results, setResults] = useState<Result[]>([]);
	const [isPending, setIsPending] = useState(false);

	async function handlePing() {
		setIsPending(true);
		const startedAt = performance.now();
		await ping();
		const ms = Math.round(performance.now() - startedAt);
		setResults((prev) => [{ label: `ping @ ${new Date().toLocaleTimeString()}`, ms }, ...prev].slice(0, 15));
		setIsPending(false);
	}

	async function handleSearch() {
		setIsPending(true);
		const startedAt = performance.now();
		await searchAllMedia("seth");
		const ms = Math.round(performance.now() - startedAt);
		setResults((prev) => [{ label: `search("seth") @ ${new Date().toLocaleTimeString()}`, ms }, ...prev].slice(0, 15));
		setIsPending(false);
	}

	return (
		<div style={{ padding: 24, maxWidth: 560, fontFamily: "monospace" }}>
			<h1 style={{ fontSize: 18, marginBottom: 8 }}>Search latency diagnostic</h1>
			<p style={{ opacity: 0.7, marginBottom: 16 }}>
				Ping does zero work server-side. Search here calls the same
				searchAllMedia() NavSearch does, but from this minimal page instead
				of whichever real page hosts the navbar&apos;s search box. Compare
				both against the navbar&apos;s own search, on the same page, back to
				back.
			</p>
			<div style={{ display: "flex", gap: 8 }}>
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
					{isPending ? "…" : "Ping"}
				</Clickable>
				<Clickable
					disabled={isPending}
					onClick={handleSearch}
					style={{
						padding: "8px 16px",
						cursor: "pointer",
						display: "inline-block",
						border: "1px solid currentColor",
						borderRadius: 4,
					}}>
					{isPending ? "…" : `Search "seth" (from this page)`}
				</Clickable>
			</div>
			<ul style={{ marginTop: 16, listStyle: "none", padding: 0 }}>
				{results.map((r, i) => (
					<li key={i}>
						{r.label} — {r.ms}ms (client-measured round trip)
					</li>
				))}
			</ul>
		</div>
	);
}
