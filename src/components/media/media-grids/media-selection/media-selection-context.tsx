"use client";
import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type MediaSelectionValue = {
	isActive: boolean;
	selectedIds: Set<number>;
	setActive: (active: boolean) => void;
	toggle: (mediaId: number) => void;
	setSelected: (mediaIds: number[]) => void;
};

const MediaSelectionContext = createContext<MediaSelectionValue | null>(null);

// Multi-select state for one grid. Leaving select mode clears the selection.
export function MediaSelectionProvider({ children }: { children: ReactNode }) {
	const [isActive, setIsActive] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

	const setActive = useCallback((active: boolean) => {
		setIsActive(active);
		if (!active) setSelectedIds(new Set());
	}, []);

	const toggle = useCallback((mediaId: number) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(mediaId)) next.delete(mediaId);
			else next.add(mediaId);
			return next;
		});
	}, []);

	const setSelected = useCallback((mediaIds: number[]) => {
		setSelectedIds(new Set(mediaIds));
	}, []);

	useEffect(() => {
		if (!isActive) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setActive(false);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isActive, setActive]);

	const value = useMemo(
		() => ({ isActive, selectedIds, setActive, toggle, setSelected }),
		[isActive, selectedIds, setActive, toggle, setSelected],
	);

	return (
		<MediaSelectionContext.Provider value={value}>
			{children}
		</MediaSelectionContext.Provider>
	);
}

// Null outside a MediaSelectionProvider, so cards in other grids just skip selection.
export function useMediaSelection(): MediaSelectionValue | null {
	return useContext(MediaSelectionContext);
}
