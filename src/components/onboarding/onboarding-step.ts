// Shared by the server page (initial ?step=) and the wizard (popstate).
const STEP_COUNT = 5;

export function parseOnboardingStep(value: string | null | undefined): number {
	const n = Number.parseInt(value ?? "", 10);
	return Number.isNaN(n) ? 0 : Math.min(Math.max(n, 0), STEP_COUNT - 1);
}
