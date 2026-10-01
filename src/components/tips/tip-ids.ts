// Every one-time page tip; tips-actions.ts rejects any other id.
export const TIP_IDS = [
	"watchlist",
	"watched",
	"difficulty",
	"recommendation",
	"mediaTypeSwitcher",
] as const;

export type TipId = (typeof TIP_IDS)[number];

export function isTipId(value: string): value is TipId {
	return (TIP_IDS as readonly string[]).includes(value);
}
