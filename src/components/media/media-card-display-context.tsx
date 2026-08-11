"use client";
import { createContext, ReactNode, useContext } from "react";

type MediaCardDisplayOptions = {
	showRating: boolean;
	showTitle: boolean;
};

const defaultOptions: MediaCardDisplayOptions = {
	showRating: true,
	showTitle: true,
};

const MediaCardDisplayContext =
	createContext<MediaCardDisplayOptions>(defaultOptions);

type ProviderProps = {
	showRating?: boolean | undefined;
	showTitle?: boolean | undefined;
	children: ReactNode;
};

// Lets a page opt a whole grid out of rendering the rating/title on its mini
// cards (e.g. a page whose own heading already states the title) without
// threading showRating/showTitle as props through every grid layer between
// here and MediaMiniCardShell, none of which have any other use for them.
export function MediaCardDisplayProvider({
	showRating = defaultOptions.showRating,
	showTitle = defaultOptions.showTitle,
	children,
}: ProviderProps) {
	return (
		<MediaCardDisplayContext.Provider value={{ showRating, showTitle }}>
			{children}
		</MediaCardDisplayContext.Provider>
	);
}

export function useMediaCardDisplay(): MediaCardDisplayOptions {
	return useContext(MediaCardDisplayContext);
}
