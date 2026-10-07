"use client";
import { Children, ReactNode, useEffect, useRef, useState } from "react";
import styles from "./home-reveal.module.sass";

// "static" until mounted, so server HTML (and no-JS) renders fully visible.
type RevealState = "static" | "hidden" | "shown";

function Reveal({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	const [state, setState] = useState<RevealState>("static");

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		// Already rendered and on screen at load — leave it alone rather than animating the first paint.
		// An empty (still streaming) section measures 0 tall, so it falls through and fades in on arrival.
		const rect = el.getBoundingClientRect();
		if (rect.height > 0 && rect.top < window.innerHeight) return;

		setState("hidden");
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				observer.disconnect();
				setState("shown");
			},
			// Positive bottom margin starts the fade just before the section crosses the viewport edge.
			{ rootMargin: "0px 0px -7% 0px" },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={ref} className={styles.reveal} data-state={state}>
			{children}
		</div>
	);
}

// Wraps each home section so it fades/slides up the first time it scrolls into view.
export function HomeReveal({ children }: { children: ReactNode }) {
	return Children.toArray(children).map((child, index) => (
		// toArray already keyed each child; index is only a fallback for the wrapper.
		<Reveal key={(child as { key?: string | null }).key ?? index}>
			{child}
		</Reveal>
	));
}
