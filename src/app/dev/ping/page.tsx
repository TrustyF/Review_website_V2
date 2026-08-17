import { PingPlayground } from "./ping-playground";

// Admin-gated (see DevMenu's "Tools" section), not dev-gated — needs to work
// in production to measure real cold-start behavior, same reasoning as
// image-crop's own page. See ping-actions.ts's comment for what this is for;
// temporary, remove once the search latency investigation is resolved.
export default function PingDevPage() {
	return <PingPlayground />;
}
