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
} from "@/components/watched/watched-actions";

type WatchedContextValue = {
	isWatched: (mediaId: number) => boolean;
	toggle: (mediaId: number) => void;
	// Adds only (never removes); resolves once saved, rejects (after reverting) on failure.
	markMany: (mediaIds: number[]) => Promise<void>;
};

const WatchedContext = createContext<WatchedContextValue | undefined>(
	undefined,
);

// Lets every media card share one "mark as watched" toggle and stay in sync,
// without each fetching its own membership row. Fetched once, mutated optimistically.
export function WatchedProvider({ children }: { children: ReactNode }) {
	const { data: session } = useSession();
	const [mediaIds, setMediaIds] = useState<Set<number>>(new Set());

	useEffect(() => {
		let cancelled = false;
		const load = session?.user?.id
			? getMyWatchedMediaIds()
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
			const wasWatched = mediaIds.has(mediaId);
			setMediaIds((prev) => {
				const next = new Set(prev);
				if (wasWatched) next.delete(mediaId);
				else next.add(mediaId);
				return next;
			});

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
			});
		},
		[mediaIds],
	);

	const markMany = useCallback(
		async (ids: number[]) => {
			const added = ids.filter((id) => !mediaIds.has(id));
			if (!added.length) return;
			setMediaIds((prev) => new Set([...prev, ...added]));
			try {
				await markManyAsWatched(added);
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

	const isWatched = useCallback(
		(mediaId: number) => mediaIds.has(mediaId),
		[mediaIds],
	);

	return (
		<WatchedContext.Provider value={{ isWatched, toggle, markMany }}>
			{children}
		</WatchedContext.Provider>
	);
}

export function useWatched(): WatchedContextValue {
	const ctx = useContext(WatchedContext);
	if (!ctx) throw new Error("useWatched must be used within WatchedProvider");
	return ctx;
}
