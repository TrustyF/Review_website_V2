"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./search-page-input.module.sass";

// Same delay as the navbar's own search (nav-search.tsx), so results refresh
// shortly after typing stops instead of re-querying on every keystroke.
const DEBOUNCE_MS = 1000;

// Refine query from results page; router.replace avoids history buildup.
export function SearchPageInput({ initialQuery }: { initialQuery: string }) {
	const dict = useDictionary();
	const router = useRouter();
	const [input, setInput] = useState(initialQuery);
	const inputRef = useRef<HTMLInputElement>(null);

	function submit(value: string) {
		const trimmed = value.trim();
		router.replace(
			trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search",
		);
	}

	// Debounces on typing; Enter still submits immediately.
	useEffect(() => {
		const timeout = setTimeout(() => submit(input), DEBOUNCE_MS);
		return () => clearTimeout(timeout);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [input]);

	return (
		<form
			className={styles.form}
			onSubmit={(e) => {
				e.preventDefault();
				submit(input);
				// Only on an explicit Enter/Go, not the debounce effect above —
				// dismisses the mobile keyboard, which a route change alone doesn't.
				inputRef.current?.blur();
			}}>
			<input
				ref={inputRef}
				type="text"
				className={styles.input}
				placeholder={dict.nav.search.placeholder}
				value={input}
				onChange={(e) => setInput(e.target.value)}
				autoFocus
			/>
		</form>
	);
}
