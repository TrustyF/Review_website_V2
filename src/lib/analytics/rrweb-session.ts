import type { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import { fetchGeo, getSessionSeed, type Geo } from "@/lib/analytics/session";

const ANALYTICS_SERVER_URL = "https://analytics.arthursirjacobs.com";
const PROJECT = "review_website";
const SEND_INTERVAL_MS = 10000;

const url = `${ANALYTICS_SERVER_URL}/api/session/add`;

let stopRecording: ReturnType<typeof record> | null = null;
let events: eventWithTime[] = [];
let sendInterval: ReturnType<typeof setInterval> | null = null;
let geo: Geo = null;
let visibilityHandler: (() => void) | null = null;
let flushOnHide: (() => void) | null = null;
// Guards the gap while rrweb's chunk is still loading — set to false means a
// stop() landed before start() finished, so the just-loaded record() must be skipped.
let starting = false;

function batchPayload(batch: eventWithTime[]) {
	return {
		source: PROJECT,
		sid: getSessionSeed(),
		geo,
		events: batch,
	};
}

// Browsers cap keepalive bodies at 64KB (shared across in-flight requests);
// anything bigger has to go as a plain fetch.
const KEEPALIVE_MAX_BYTES = 60000;

// Sent as text/plain, a CORS-safelisted type, so these cross-origin posts need
// no preflight — a beacon can never pass one (it always sends credentials,
// which the server doesn't allow). The server's req.json() ignores the type.
async function sendBatch(batch: eventWithTime[]) {
	const body = JSON.stringify(batchPayload(batch));
	const ok = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "text/plain" },
		body,
		// lets a flush started as the tab hides survive the page closing
		keepalive: body.length < KEEPALIVE_MAX_BYTES,
	})
		.then((res) => res.ok)
		.catch(() => false);

	// failed to send, requeue the batch for the next flush
	if (!ok) events = batch.concat(events);
}

function flush() {
	if (events.length === 0) return;
	const batch = events;
	events = [];
	sendBatch(batch).then();
}

// Not statically imported — rrweb is a sizable library, and this way it only
// ships to the client once a session actually starts recording, off the initial bundle.
export async function start() {
	if (stopRecording || starting) return;
	starting = true;

	fetchGeo().then((g) => {
		geo = g;
	});

	const { record } = await import("rrweb");
	if (!starting) return; // stop() landed while the chunk was loading
	starting = false;

	stopRecording = record({
		emit(event) {
			// keep the hot input path cheap; sending happens once per flush, not per event
			events.push(event);
		},
		sampling: {
			mousemove: 50,
			mouseInteraction: true,
			scroll: 150,
			input: "all",
		},
		slimDOMOptions: "all",
		// password is masked by default; email isn't, but login/signup capture it
		maskInputOptions: { password: true, email: true },
	});

	sendInterval = setInterval(flush, SEND_INTERVAL_MS);

	// Last chance as the page unloads, when a fetch could be cancelled
	flushOnHide = () => {
		if (events.length === 0) return;
		const queued = navigator.sendBeacon(
			url,
			new Blob([JSON.stringify(batchPayload(events))], { type: "text/plain" }),
		);
		// false = over the beacon size quota; keep the events in case the page survives
		if (queued) events = [];
	};
	// The page is still alive when merely hidden (tab/app switch, screen lock),
	// so a normal send that requeues on failure beats a fire-and-forget beacon
	visibilityHandler = () => {
		if (document.visibilityState === "hidden") flush();
	};
	document.addEventListener("visibilitychange", visibilityHandler);
	window.addEventListener("pagehide", flushOnHide);
}

export function stop() {
	starting = false;
	if (stopRecording) {
		stopRecording();
		stopRecording = null;
	}
	if (sendInterval) {
		clearInterval(sendInterval);
		sendInterval = null;
	}
	if (visibilityHandler) {
		document.removeEventListener("visibilitychange", visibilityHandler);
		visibilityHandler = null;
	}
	if (flushOnHide) {
		window.removeEventListener("pagehide", flushOnHide);
		flushOnHide = null;
	}
	// send what's buffered rather than dropping it — stop() also runs when the
	// auth status changes (e.g. on login), mid-session
	flush();
}
