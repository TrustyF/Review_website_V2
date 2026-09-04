// Real sends use SITE_URL (sendEmail() calls render() directly, no asset
// server involved); npm run email_dev has no SITE_URL, so it falls back to
// its own preview server's /static route, backed by src/emails/static/.
export function emailAssetSrc(publicPath: string): string {
	const siteUrl = process.env.SITE_URL;
	if (siteUrl) return `${siteUrl.replace(/\/$/, "")}${publicPath}`;
	return `/static/${publicPath.replace(/^\/ui\//, "")}`;
}
