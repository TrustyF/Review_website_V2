import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getImageStorage } from "@/server/storage/image-storage";
import { DIGEST_BANNER_COMPOSITE_DIR } from "@/server/resolvers/asset-paths";
import type { Locale } from "@/lib/i18n/get-locale";

// The digest banner as one JPEG with the photo, gradient, logo, headline and date baked in.
// Mail clients drop web fonts, CSS gradients and background images, but never a plain <img>.

// Email-px layout, mirrored from DigestBanner's HTML fallback.
export const DIGEST_BANNER_WIDTH = 600;
const HEIGHT = 220;
const SIDE_COLUMN = 170;
const PAD_X = 16;
const PAD_TOP = 12;
// Rendered at 2x so it stays sharp on high-DPI screens.
const SCALE = 2;
const JPEG_QUALITY = 82;

// Bump when the layout below changes, so already-cached banners get re-rendered.
const RENDER_VERSION = 1;

const FONT_URLS = {
	playfair700:
		"https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf",
	roboto500:
		"https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWub2bWmTggvWlnwk.ttf",
	roboto700:
		"https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammTggvWlnwk.ttf",
};

async function fetchBytes(url: string): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`Fetch failed (${response.status}): ${url}`);
	return response.arrayBuffer();
}

// JPEG/PNG within the render width pass through untouched (the email banner cache already is
// one); only WebP/AVIF (Satori can't decode them) or oversized sources get re-encoded.
async function photoDataUri(bannerSrc: string): Promise<string> {
	const source = Buffer.from(await fetchBytes(bannerSrc));
	const { format, width } = await sharp(source).metadata();
	const maxWidth = DIGEST_BANNER_WIDTH * SCALE;
	if ((format === "jpeg" || format === "png") && width <= maxWidth) {
		return `data:image/${format};base64,${source.toString("base64")}`;
	}
	const jpeg = await sharp(source)
		.resize({ width: maxWidth, withoutEnlargement: true })
		.jpeg({ quality: 90 })
		.toBuffer();
	return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function iconDataUri(): Promise<string> {
	const icon = await readFile(
		path.join(/* turbopackIgnore: true */ process.cwd(), "public/ui/icon.png"),
	);
	return `data:image/png;base64,${icon.toString("base64")}`;
}

type BannerContent = {
	bannerSrc: string | null;
	headline: string;
	dateLabel: string;
};

async function renderBanner({
	bannerSrc,
	headline,
	dateLabel,
}: BannerContent): Promise<Buffer> {
	const s = SCALE;
	const [playfair, roboto500, roboto700, icon, photo] = await Promise.all([
		fetchBytes(FONT_URLS.playfair700),
		fetchBytes(FONT_URLS.roboto500),
		fetchBytes(FONT_URLS.roboto700),
		iconDataUri(),
		bannerSrc ? photoDataUri(bannerSrc) : null,
	]);

	const image = new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				position: "relative",
				backgroundColor: "#1a1a1a",
			}}>
			{photo && (
				// eslint-disable-next-line @next/next/no-img-element -- Satori input, not page markup
				<img
					src={photo}
					alt=""
					width={DIGEST_BANNER_WIDTH * s}
					height={HEIGHT * s}
					style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
				/>
			)}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					backgroundImage:
						"linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 30%)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					top: PAD_TOP * s,
					left: PAD_X * s,
					display: "flex",
					alignItems: "center",
				}}>
				{/* eslint-disable-next-line @next/next/no-img-element -- Satori input, not page markup */}
				<img src={icon} alt="" width={28 * s} height={28 * s} />
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						marginLeft: 8 * s,
						fontFamily: "Roboto",
						fontWeight: 700,
						fontSize: 13 * s,
						lineHeight: 1.05,
						color: "#ffffff",
					}}>
					<span>Arthur&apos;s</span>
					<span>corner</span>
				</div>
			</div>
			<div
				style={{
					position: "absolute",
					// Vertically centred so a 3-line headline (French) still clears the bottom edge.
					top: 0,
					height: "100%",
					left: (PAD_X + SIDE_COLUMN) * s,
					width: (DIGEST_BANNER_WIDTH - 2 * (PAD_X + SIDE_COLUMN)) * s,
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					textAlign: "center",
					color: "#ffffff",
				}}>
				<div
					style={{
						fontFamily: "Playfair Display",
						fontWeight: 700,
						fontSize: 50 * s,
						lineHeight: 1,
						textShadow: `${s}px ${s}px ${3 * s}px rgba(0,0,0,0.85)`,
					}}>
					{headline}
				</div>
				<div
					style={{
						marginTop: 8 * s,
						fontFamily: "Roboto",
						fontWeight: 500,
						fontSize: 12 * s,
						textShadow: `${s}px ${s}px ${2 * s}px rgba(0,0,0,0.95)`,
					}}>
					{dateLabel}
				</div>
			</div>
		</div>,
		{
			width: DIGEST_BANNER_WIDTH * s,
			height: HEIGHT * s,
			fonts: [
				{
					name: "Playfair Display",
					data: playfair,
					weight: 700,
					style: "normal",
				},
				{ name: "Roboto", data: roboto500, weight: 500, style: "normal" },
				{ name: "Roboto", data: roboto700, weight: 700, style: "normal" },
			],
		},
	);

	// ImageResponse only emits PNG, which is far too heavy for a photo in an email.
	return sharp(Buffer.from(await image.arrayBuffer()))
		.jpeg({ quality: JPEG_QUALITY })
		.toBuffer();
}

// Preview only: inlined, never stored, so opening the admin preview doesn't pile up files.
// null on failure, same as resolveDigestBannerImage.
export async function renderDigestBannerDataUri(
	content: BannerContent,
): Promise<string | null> {
	try {
		const jpeg = await renderBanner(content);
		return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
	} catch (error) {
		console.error("[digest-banner] render failed", error);
		return null;
	}
}

// Stored banner's URL, or null on failure (the HTML banner takes over). Filenames are
// locale-prefixed so cleanup-digest-banners.ts can keep the newest few per language.
export async function resolveDigestBannerImage(
	content: BannerContent,
	locale: Locale,
): Promise<string | null> {
	const hash = createHash("sha256")
		.update(
			JSON.stringify([
				RENDER_VERSION,
				content.bannerSrc,
				content.headline,
				content.dateLabel,
			]),
		)
		.digest("hex")
		.slice(0, 16);
	const filename = `${locale}-${hash}.jpeg`;
	const storage = getImageStorage();

	if (!(await storage.read(DIGEST_BANNER_COMPOSITE_DIR, filename))) {
		try {
			await storage.write(
				DIGEST_BANNER_COMPOSITE_DIR,
				filename,
				await renderBanner(content),
			);
		} catch (error) {
			console.error("[digest-banner] render failed", error);
			return null;
		}
	}
	return storage.urlFor(DIGEST_BANNER_COMPOSITE_DIR, filename);
}
