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
import type { TipId } from "@/components/tips/tip-ids";
import { getMySeenTips, markTipSeen } from "@/components/tips/tips-actions";

type TipsContextValue = {
	// True while loading or signed out, so tips only ever show to a known account.
	isSeen: (id: TipId) => boolean;
	// Only one tip shows at a time: the first visible one to claim the slot.
	activeId: TipId | null;
	claim: (id: TipId) => void;
	release: (id: TipId) => void;
	// Called once a tip is on screen, so leaving the page without clicking still counts.
	markSeen: (id: TipId) => void;
	// Hides the showing tip early; it's already marked seen by then.
	dismiss: (id: TipId) => void;
};

const TipsContext = createContext<TipsContextValue | undefined>(undefined);

// TEMP for testing: ignores saved seen tips and doesn't save new ones, so each full
// reload shows them all again. Set back to false to restore normal behavior.
const ALWAYS_SHOW_TIPS = true;

// Fetched client-side like AvatarProvider, so RootLayout stays static.
export function TipsProvider({ children }: { children: ReactNode }) {
	const { data: session } = useSession();
	const userId = session?.user?.id;
	const [seen, setSeen] = useState<string[] | null>(null);
	const [activeId, setActiveId] = useState<TipId | null>(null);
	const [seenThisLoad, setSeenThisLoad] = useState<string[]>([]);

	useEffect(() => {
		if (!userId) return;
		let cancelled = false;
		getMySeenTips().then((tips) => {
			if (!cancelled) setSeen(tips);
		});
		return () => {
			cancelled = true;
		};
	}, [userId]);

	const currentSeen = !userId ? null : ALWAYS_SHOW_TIPS ? seenThisLoad : seen;
	const isSeen = useCallback(
		(id: TipId) => currentSeen === null || currentSeen.includes(id),
		[currentSeen],
	);
	const claim = useCallback((id: TipId) => {
		setActiveId((current) => current ?? id);
	}, []);
	const release = useCallback((id: TipId) => {
		setActiveId((current) => (current === id ? null : current));
	}, []);
	const markSeen = useCallback((id: TipId) => {
		const add = (current: string[]) =>
			current.includes(id) ? current : [...current, id];
		if (ALWAYS_SHOW_TIPS) {
			setSeenThisLoad(add);
			return;
		}
		setSeen((current) => (current ? add(current) : current));
		void markTipSeen(id);
	}, []);
	const dismiss = useCallback((id: TipId) => {
		setActiveId((current) => (current === id ? null : current));
	}, []);

	return (
		<TipsContext.Provider
			value={{ isSeen, activeId, claim, release, markSeen, dismiss }}>
			{children}
		</TipsContext.Provider>
	);
}

export function useTips(): TipsContextValue {
	const ctx = useContext(TipsContext);
	if (!ctx) throw new Error("useTips must be used within TipsProvider");
	return ctx;
}
