"use client";
import { createContext, type ReactNode, useContext } from "react";

// The viewer's "never hide spoilers" account setting, resolved server-side (getShowSpoilers) so the
// first render already matches and nothing flips from bars to text after load.
const ShowSpoilersContext = createContext(false);

export function ShowSpoilersProvider({
	value,
	children,
}: {
	value: boolean;
	children: ReactNode;
}) {
	return (
		<ShowSpoilersContext.Provider value={value}>
			{children}
		</ShowSpoilersContext.Provider>
	);
}

export function useShowSpoilers(): boolean {
	return useContext(ShowSpoilersContext);
}
