"use client";
import { createContext, useContext } from "react";

// Overrides LazyMediaGrid's default auto-fill column packing — LazyMediaGrid
// sits several levels below most of its callers (through GroupedMediaGrid/
// RatedTierGrid), so a context avoids threading a "columns" prop down
// through components that have no other reason to know about it. Pages with
// an unusually narrow or wide content column (e.g. credit-media-list-page's
// sidebar-narrowed column) can wrap their grid in
// <MediaGridColumnsProvider value={n}> to force exactly n columns instead of
// however many the default minmax auto-fill happens to pack in.
const MediaGridColumnsContext = createContext<number | null>(null);

export const MediaGridColumnsProvider = MediaGridColumnsContext.Provider;

export function useMediaGridColumns() {
	return useContext(MediaGridColumnsContext);
}
