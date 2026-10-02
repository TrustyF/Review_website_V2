// Absolute URLs required in email HTML and server-side fetch(), neither resolves root-relative paths.
export function toAbsoluteUrl(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(
		/\/$/,
		"",
	);
	return `${base}${path}`;
}
