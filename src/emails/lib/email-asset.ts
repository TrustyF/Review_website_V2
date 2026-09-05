// Real sends use SITE_URL; email_dev uses preview server.
export function emailAssetSrc(publicPath: string): string {
	const siteUrl = process.env.SITE_URL;
	if (siteUrl) return `${siteUrl.replace(/\/$/, "")}${publicPath}`;
	return `/static/${publicPath.replace(/^\/ui\//, "")}`;
}
