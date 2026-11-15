"use client";
import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";

type Command = "start" | "stop";

declare global {
	interface Window {
		// the recorder's api once recorder.js has run, a queue of commands it replays until then
		arthurRecorder?: Record<Command, () => void> | Command[];
	}
}

// Runs the command now if recorder.js has loaded, otherwise queues it for when it does.
function recorder(command: Command) {
	const current = window.arthurRecorder;
	if (current && !Array.isArray(current)) current[command]();
	else (window.arthurRecorder = current ?? []).push(command);
}

// Crawlers that execute JS (Googlebot's renderer, Bing, previews, headless tools).
const BOT_UA =
	/bot|crawl|spider|slurp|headless|lighthouse|inspectiontool|mediapartners|facebookexternalhit|preview|pingdom|gtmetrix/i;

const noopSubscribe = () => () => {};
const isBotClient = () =>
	navigator.webdriver || BOT_UA.test(navigator.userAgent);
// Assume bot on the server so the script only mounts once the client confirms a human.
const isBotServer = () => true;

// Session recording via the analytics server's shared recorder.js, mounted once
// in layout.tsx. Skipped in dev, for bots, and for admins (admin screens show others' PII).
export function RrwebAnalytics() {
	const { data: session, status } = useSession();
	const isAdmin = session?.user?.role === "ADMIN";
	const isBot = useSyncExternalStore(noopSubscribe, isBotClient, isBotServer);

	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		if (status === "loading") return;
		if (isAdmin || isBot) return;

		recorder("start");
		// also runs when the auth status changes (e.g. on login), mid-session
		return () => recorder("stop");
	}, [status, isAdmin, isBot]);

	if (process.env.NODE_ENV !== "production" || isBot) return null;
	// data-manual: started and stopped by the effect above instead of on load
	return (
		<Script
			src="https://analytics.arthursirjacobs.com/recorder.js"
			data-source="review_website"
			data-manual=""
		/>
	);
}
