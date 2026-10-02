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
	getMyWatchedMediaIds,
	markAsWatched,
	markManyAsWatched,
	unmarkAsWatched,
	unmarkManyAsWatched,
} from "@/components/watched/watched-actions";
import { useWatchlist } from "@/components/watchlist/watchlist-context";

type WatchedContextValue = {
	// False until the first fetch lands; callers fall back to server-rendered state meanwhile.
	ready: boolean;
	isWatched: (mediaId: number) => boolean;
	toggle: (mediaId: number) => void;
	// Adds only (never removes); resolves once saved, rejects (after reverting) on failure.
	markMany: (mediaIds: number[]) => Promise<void>;
	// Removes only; same resolve/reject contract as markMany.
	unmarkMany: (mediaIds: number[]) => Promise<void>;
};

const WatchedContext = createContext<WatchedContextValue | undefined>(
	undefined,
);

// Lets every media card share one "mark as watched" toggle and stay in sync,
// without each fetching its own membership row. Fetched once, mutated optimistically.
export function WatchedProvider({ children }: { children: ReactNode }) {
	const { data: session } = useSession();
	const [mediaIds, setMediaIds] = useState<Set<number>>(new Set());
	const [ready, setReady] = useState(false);
	// Marking watched also takes items off the watchlist (server does the same).
	const { isInWatchlist, dropLocally, restoreLocally } = useWatchlist();

	useEffect(() => {
		let cancelled = false;
		const load = session?.user?.id
			? getMyWatchedMediaIds()
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
			const wasWatched = mediaIds.has(mediaId);
			setMediaIds((prev) => {
				const next = new Set(prev);
				if (wasWatched) next.delete(mediaId);
				else next.add(mediaId);
				return next;
			});

			const dropped = !wasWatched && isInWatchlist(mediaId) ? [mediaId] : [];
			dropLocally(dropped);

			const action = wasWatched
				? unmarkAsWatched(mediaId)
				: markAsWatched(mediaId);
			action.catch(() => {
				setMediaIds((prev) => {
					const reverted = new Set(prev);
					if (wasWatched) reverted.add(mediaId);
					else reverted.delete(mediaId);
					return reverted;
				});
				restoreLocally(dropped);
			});
		},
		[mediaIds, isInWatchlist, dropLocally, restoreLocally],
	);

	const markMany = useCallback(
		async (ids: number[]) => {
			const added = ids.filter((id) => !mediaIds.has(id));
			if (!added.length) return;
			const dropped = added.filter(isInWatchlist);
			setMediaIds((prev) => new Set([...prev, ...added]));
			dropLocally(dropped);
			try {
				await markManyAsWatched(added);
			} catch (error) {
				setMediaIds((prev) => {
					const reverted = new Set(prev);
					for (const id of added) reverted.delete(id);
					return reverted;
				});
				restoreLocally(dropped);
				throw error;
			}
		},
		[mediaIds, isInWatchlist, dropLocally, restoreLocally],
	);

	const unmarkMany = useCallback(
		async (ids: number[]) => {
			const removed = ids.filter((id) => mediaIds.has(id));
			if (!removed.length) return;
			setMediaIds((prev) => {
				const next = new Set(prev);
				for (const id of removed) next.delete(id);
				return next;
			});
			try {
				await unmarkManyAsWatched(removed);
			} catch (error) {
				setMediaIds((prev) => new Set([...prev, ...removed]));
				throw error;
			}
		},
		[mediaIds],
	);

	const isWatched = useCallback(
		(mediaId: number) => mediaIds.has(mediaId),
		[mediaIds],
	);

	return (
		<WatchedContext.Provider
			value={{ ready, isWatched, toggle, markMany, unmarkMany }}>
			{children}
		</WatchedContext.Provider>
	);
}

export function useWatched(): WatchedContextValue {
	const ctx = useContext(WatchedContext);
	if (!ctx) throw new Error("useWatched must be used within WatchedProvider");
	return ctx;
}
