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

// Lets every media card across the app (grids, related-media strips, ...)
// share one hover "add to watchlist" toggle and stay in sync with each
// other, without each card fetching its own membership row — same shape as
// AvatarProvider: fetched once per page load via a server action, kept in
// client state, mutated optimistically.
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
