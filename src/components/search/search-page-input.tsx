"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import styles from "./search-page-input.module.sass";

// Same delay as the navbar's own search (nav-search.tsx), so results refresh
// shortly after typing stops instead of re-querying on every keystroke.
const DEBOUNCE_MS = 1000;

// Lets a visitor refine the query from the results page itself, not just
// from the navbar. Uses router.replace (not push) so retyping here doesn't
// pile up a back-button history entry per keystroke-submit.
export function SearchPageInput({ initialQuery }: { initialQuery: string }) {
	const router = useRouter();
	const [input, setInput] = useState(initialQuery);

	function submit(value: string) {
		const trimmed = value.trim();
		router.replace(
			trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search",
		);
	}

	// Debounces on typing; Enter/click below still submit immediately.
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
			}}>
			<input
				type="text"
				className={styles.input}
				placeholder="Search…"
				value={input}
				onChange={(e) => setInput(e.target.value)}
				autoFocus
			/>
			<Clickable
				className={styles.submit}
				aria-label="Search"
				onClick={() => submit(input)}>
				<Search size={18} />
			</Clickable>
		</form>
	);
}
