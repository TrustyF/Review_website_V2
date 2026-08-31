"use client";
import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { useSession } from "next-auth/react";
import {
	addToWatchlist,
	getMyWatchlistMediaIds,
	removeFromWatchlist,
} from "@/components/watchlist/watchlist-actions";

type WatchlistContextValue = {
	isInWatchlist: (mediaId: number) => boolean;
	toggle: (mediaId: number) => void;
};

const WatchlistContext = createContext<WatchlistContextValue | undefined>(
	undefined,
);

// Lets every media card share one "add to watchlist" toggle and stay in sync,
// without each fetching its own membership row. Fetched once, mutated optimistically.
export function WatchlistProvider({ children }: { children: ReactNode }) {
	const { data: session } = useSession();
	const [mediaIds, setMediaIds] = useState<Set<number>>(new Set());

	useEffect(() => {
		let cancelled = false;
		const load = session?.user?.id
			? getMyWatchlistMediaIds()
			: Promise.resolve<number[]>([]);
		load.then((ids) => {
			if (!cancelled) setMediaIds(new Set(ids));
		});
		return () => {
			cancelled = true;
		};
	}, [session?.user?.id]);

	const toggle = useCallback(
		(mediaId: number) => {
			const wasInWatchlist = mediaIds.has(mediaId);
			setMediaIds((prev) => {
				const next = new Set(prev);
				if (wasInWatchlist) next.delete(mediaId);
				else next.add(mediaId);
				return next;
			});

			const action = wasInWatchlist
				? removeFromWatchlist(mediaId)
				: addToWatchlist(mediaId);
			action.catch(() => {
				setMediaIds((prev) => {
					const reverted = new Set(prev);
					if (wasInWatchlist) reverted.add(mediaId);
					else reverted.delete(mediaId);
					return reverted;
				});
			});
		},
		[mediaIds],
	);

	const isInWatchlist = useCallback(
		(mediaId: number) => mediaIds.has(mediaId),
		[mediaIds],
	);

	return (
		<WatchlistContext.Provider value={{ isInWatchlist, toggle }}>
			{children}
		</WatchlistContext.Provider>
	);
}

export function useWatchlist(): WatchlistContextValue {
	const ctx = useContext(WatchlistContext);
	if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
	return ctx;
}
