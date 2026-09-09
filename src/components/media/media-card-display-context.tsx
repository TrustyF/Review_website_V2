"use client";
import { createContext, ReactNode, useContext } from "react";

type MediaCardDisplayOptions = {
	showRating: boolean;
	showTitle: boolean;
	showReviewIcon: boolean;
	// Movie/TV mini cards' own release date, in the info row's children slot — off
	// by default since most grids already show a rating there instead.
	showReleaseDate: boolean;
};

const defaultOptions: MediaCardDisplayOptions = {
	showRating: true,
	showTitle: true,
	showReviewIcon: true,
	showReleaseDate: false,
};

const MediaCardDisplayContext =
	createContext<MediaCardDisplayOptions>(defaultOptions);

type ProviderProps = {
	showRating?: boolean | undefined;
	showTitle?: boolean | undefined;
	showReviewIcon?: boolean | undefined;
	showReleaseDate?: boolean | undefined;
	children: ReactNode;
};

// Lets a page opt a grid out of rating/title/review icon on mini cards without threading props through every grid layer down to MediaMiniCardShell.
export function MediaCardDisplayProvider({
	showRating = defaultOptions.showRating,
	showTitle = defaultOptions.showTitle,
	showReviewIcon = defaultOptions.showReviewIcon,
	showReleaseDate = defaultOptions.showReleaseDate,
	children,
}: ProviderProps) {
	return (
		<MediaCardDisplayContext.Provider
			value={{ showRating, showTitle, showReviewIcon, showReleaseDate }}>
			{children}
		</MediaCardDisplayContext.Provider>
	);
}

export function useMediaCardDisplay(): MediaCardDisplayOptions {
	return useContext(MediaCardDisplayContext);
}
