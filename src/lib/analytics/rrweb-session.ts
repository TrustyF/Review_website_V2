import { record } from "rrweb";
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

function batchPayload(batch: eventWithTime[]) {
	return {
		source: PROJECT,
		sid: getSessionSeed(),
		geo,
		events: batch,
	};
}

async function sendBatch(batch: eventWithTime[]) {
	const ok = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(batchPayload(batch)),
	})
		.then((res) => res.ok)
		.catch(() => false);

	// failed to send, requeue the batch for the next flush
	if (!ok) events = batch.concat(events);
}

export function start() {
	if (stopRecording) return;

	fetchGeo().then((g) => {
		geo = g;
	});

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

	sendInterval = setInterval(() => {
		if (events.length === 0) return;
		const batch = events;
		events = [];
		sendBatch(batch).then();
	}, SEND_INTERVAL_MS);

	flushOnHide = () => {
		if (events.length === 0) return;
		navigator.sendBeacon(
			url,
			new Blob([JSON.stringify(batchPayload(events))], {
				type: "application/json",
			}),
		);
		events = [];
	};
	visibilityHandler = () => {
		if (document.visibilityState === "hidden") flushOnHide?.();
	};
	document.addEventListener("visibilitychange", visibilityHandler);
	window.addEventListener("pagehide", flushOnHide);
}

export function stop() {
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
	events = [];
}
