"use client";
import { createContext, ReactNode, useContext } from "react";

type MediaCardDisplayOptions = {
	showRating: boolean;
	showTitle: boolean;
	showReviewIcon: boolean;
};

const defaultOptions: MediaCardDisplayOptions = {
	showRating: true,
	showTitle: true,
	showReviewIcon: true,
};

const MediaCardDisplayContext =
	createContext<MediaCardDisplayOptions>(defaultOptions);

type ProviderProps = {
	showRating?: boolean | undefined;
	showTitle?: boolean | undefined;
	showReviewIcon?: boolean | undefined;
	children: ReactNode;
};

// Lets a page opt a whole grid out of rendering the rating/title/review icon
// on its mini cards (e.g. a page whose own heading already states the
// title, or a grid where every item is already known to have a review) —
// without threading these as props through every grid layer between here
// and MediaMiniCardShell, none of which have any other use for them.
export function MediaCardDisplayProvider({
	showRating = defaultOptions.showRating,
	showTitle = defaultOptions.showTitle,
	showReviewIcon = defaultOptions.showReviewIcon,
	children,
}: ProviderProps) {
	return (
		<MediaCardDisplayContext.Provider
			value={{ showRating, showTitle, showReviewIcon }}>
			{children}
		</MediaCardDisplayContext.Provider>
	);
}

export function useMediaCardDisplay(): MediaCardDisplayOptions {
	return useContext(MediaCardDisplayContext);
}
