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
	addManyToWatchlist,
	getMyWatchlistMediaIds,
	removeFromWatchlist,
	removeManyFromWatchlist,
} from "@/components/watchlist/watchlist-actions";

type WatchlistContextValue = {
	// False until the first fetch lands; callers fall back to server-rendered state meanwhile.
	ready: boolean;
	isInWatchlist: (mediaId: number) => boolean;
	toggle: (mediaId: number) => void;
	// Adds only (never removes); resolves once saved, rejects (after reverting) on failure.
	addMany: (mediaIds: number[]) => Promise<void>;
	// Removes only; same resolve/reject contract as addMany.
	removeMany: (mediaIds: number[]) => Promise<void>;
	// Local state only, for WatchedProvider: the server drops watchlist rows itself when marking watched.
	dropLocally: (mediaIds: number[]) => void;
	restoreLocally: (mediaIds: number[]) => void;
};

const WatchlistContext = createContext<WatchlistContextValue | undefined>(
	undefined,
);

// Lets every media card share one "add to watchlist" toggle and stay in sync,
// without each fetching its own membership row. Fetched once, mutated optimistically.
export function WatchlistProvider({ children }: { children: ReactNode }) {
	const { data: session } = useSession();
	const [mediaIds, setMediaIds] = useState<Set<number>>(new Set());
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const load = session?.user?.id
			? getMyWatchlistMediaIds()
			: Promise.resolve<number[]>([]);
		load.then((ids) => {
			if (cancelled) return;
			setMediaIds(new Set(ids));
			setReady(true);
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

	const addMany = useCallback(
		async (ids: number[]) => {
			const added = ids.filter((id) => !mediaIds.has(id));
			if (!added.length) return;
			setMediaIds((prev) => new Set([...prev, ...added]));
			try {
				await addManyToWatchlist(added);
			} catch (error) {
				setMediaIds((prev) => {
					const reverted = new Set(prev);
					for (const id of added) reverted.delete(id);
					return reverted;
				});
				throw error;
			}
		},
		[mediaIds],
	);

	const removeMany = useCallback(
		async (ids: number[]) => {
			const removed = ids.filter((id) => mediaIds.has(id));
			if (!removed.length) return;
			setMediaIds((prev) => {
				const next = new Set(prev);
				for (const id of removed) next.delete(id);
				return next;
			});
			try {
				await removeManyFromWatchlist(removed);
			} catch (error) {
				setMediaIds((prev) => new Set([...prev, ...removed]));
				throw error;
			}
		},
		[mediaIds],
	);

	const dropLocally = useCallback((ids: number[]) => {
		setMediaIds((prev) => {
			const next = new Set(prev);
			for (const id of ids) next.delete(id);
			return next;
		});
	}, []);

	const restoreLocally = useCallback((ids: number[]) => {
		setMediaIds((prev) => new Set([...prev, ...ids]));
	}, []);

	const isInWatchlist = useCallback(
		(mediaId: number) => mediaIds.has(mediaId),
		[mediaIds],
	);

	return (
		<WatchlistContext.Provider
			value={{
				ready,
				isInWatchlist,
				toggle,
				addMany,
				removeMany,
				dropLocally,
				restoreLocally,
			}}>
			{children}
		</WatchlistContext.Provider>
	);
}

export function useWatchlist(): WatchlistContextValue {
	const ctx = useContext(WatchlistContext);
	if (!ctx)
		throw new Error("useWatchlist must be used within WatchlistProvider");
	return ctx;
}
