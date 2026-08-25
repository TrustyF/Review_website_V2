// Tier assignment per nav_group, right to left — tier 1 is the widest
// breakpoint (collapses first, as the viewport starts narrowing), tier 4 the
// narrowest (collapses last). Keeps labels disappearing one group at a time
// instead of every link's text vanishing together at one shared breakpoint.
// Watchlist/Account are iconOnly already (no label to collapse at all), so
// only the sign-out/sign-in label actually uses ACCOUNT here.
export const COLLAPSE_TIER = {
	ACCOUNT: 1,
	ACTIVITY: 2,
	BROWSE: 3,
	HOME: 4,
} as const;
