import { createTransport } from "nodemailer";
import { render } from "@react-email/render";
import type { ReactElement } from "react";

let transport: ReturnType<typeof createTransport> | null = null;

function getTransport() {
	if (transport) return transport;
	const host = process.env.SMTP_HOST;
	const port = process.env.SMTP_PORT;
	const user = process.env.SMTP_USER;
	const password = process.env.SMTP_PASSWORD;
	if (!host || !port || !user || !password) {
		throw new Error(
			"SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD must all be set — see .env.example.",
		);
	}
	transport = createTransport({
		host,
		port: Number(port),
		// 465 is the implicit-TLS port; every other port (587, 25) starts
		// plaintext and upgrades via STARTTLS, which nodemailer already does
		// on its own when secure is false.
		secure: Number(port) === 465,
		auth: { user, pass: password },
	});
	return transport;
}

// Renders a React Email component to HTML and sends it via the SMTP relay
// configured in .env (see mailer.ts's own env-var checks). Used by the
// weekly-digest/list-add-digest cron scripts, not from request handling —
// both emails are sent as batches, never inline on a user action.
export async function sendEmail(input: {
	to: string;
	subject: string;
	react: ReactElement;
}): Promise<void> {
	const html = await render(input.react);
	await getTransport().sendMail({
		from: process.env.EMAIL_FROM,
		to: input.to,
		subject: input.subject,
		html,
	});
}

// Absolute URLs are required in email HTML — mail clients don't resolve
// relative paths against any base — but LocalImageStorage.urlFor and every
// app route return root-relative ones. R2ImageStorage's urlFor already
// returns an absolute URL, so this is a no-op there.
export function toAbsoluteUrl(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
	return `${base}${path}`;
}
