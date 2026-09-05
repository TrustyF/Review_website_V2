import crypto from "crypto";

export type UnsubscribeField = "newsletterOptIn" | "listAddEmailOptIn";

function secret(): string {
	const value = process.env.AUTH_SECRET;
	if (!value)
		throw new Error("AUTH_SECRET is required to sign unsubscribe tokens");
	return value;
}

function sign(payload: string): string {
	return crypto
		.createHmac("sha256", secret())
		.update(payload)
		.digest("base64url");
}

export function buildUnsubscribeToken(
	userId: string,
	field: UnsubscribeField,
): string {
	const payload = `${userId}.${field}`;
	const encoded = Buffer.from(payload, "utf-8").toString("base64url");
	return `${encoded}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(
	token: string,
): { userId: string; field: UnsubscribeField } | null {
	const [encoded, signature] = token.split(".");
	if (!encoded || !signature) return null;

	const payload = Buffer.from(encoded, "base64url").toString("utf-8");
	const expected = sign(payload);

	const actualBuf = Buffer.from(signature);
	const expectedBuf = Buffer.from(expected);
	if (actualBuf.length !== expectedBuf.length) return null;
	if (!crypto.timingSafeEqual(actualBuf, expectedBuf)) return null;

	const [userId, field] = payload.split(".");
	if (!userId || (field !== "newsletterOptIn" && field !== "listAddEmailOptIn"))
		return null;

	return { userId, field };
}
