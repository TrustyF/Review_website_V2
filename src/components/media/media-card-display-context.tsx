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

// Lets a page opt a grid out of rating/title/review icon on mini cards without threading props through every grid layer down to MediaMiniCardShell.
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
