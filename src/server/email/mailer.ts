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
		// 465 is implicit-TLS; others (587, 25) plaintext→STARTTLS (nodemailer handles this).
		secure: Number(port) === 465,
		auth: { user, pass: password },
	});
	return transport;
}

// Renders React Email to HTML; sent by cron scripts (weekly-digest, list-add), not inline
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

// Absolute URLs required in email HTML (mail clients don't resolve relative paths). LocalImageStorage returns root-relative; this converts to absolute.
export function toAbsoluteUrl(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
	return `${base}${path}`;
}
