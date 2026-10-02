import type { Metadata } from "next";
import { ImageCropTool } from "./image-crop-tool";

export const metadata: Metadata = { title: "Image crop" };

// Admin-gated (ImageCropTool's own isAdmin check), not dev-gated — used in production.
// Works on ad hoc local uploads and hands back a path to paste in manually.
export default function ImageCropDevPage() {
	return <ImageCropTool />;
}
