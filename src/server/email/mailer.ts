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

// Renders React Email to HTML (+ a plain-text part — HTML-only mail is a
// spam signal) and sends via nodemailer.
export async function sendEmail(input: {
	to: string;
	subject: string;
	react: ReactElement;
	// RFC 8058 one-click unsubscribe header — pass for bulk mail (the weekly
	// digest), omit for a one-off transactional send. A real spam signal to
	// Gmail/Yahoo when missing, independent of SPF/DKIM/DMARC.
	unsubscribeUrl?: string;
}): Promise<void> {
	const [html, text] = await Promise.all([
		render(input.react),
		render(input.react, { plainText: true }),
	]);
	await getTransport().sendMail({
		from: process.env.EMAIL_FROM,
		to: input.to,
		subject: input.subject,
		html,
		text,
		...(input.unsubscribeUrl
			? {
					headers: {
						"List-Unsubscribe": `<${input.unsubscribeUrl}>`,
						"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
					},
				}
			: {}),
	});
}

// Absolute URLs required in email HTML (mail clients don't resolve relative paths). LocalImageStorage returns root-relative; this converts to absolute.
export function toAbsoluteUrl(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
	return `${base}${path}`;
}
