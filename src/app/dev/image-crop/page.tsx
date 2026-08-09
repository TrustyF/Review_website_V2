import { ImageCropTool } from "./image-crop-tool";

// Admin-gated (see ImageCropTool's own isAdmin check), not dev-gated — used
// in production, unlike the rest of this app's actual /dev/* pages. No DB
// data needed (unlike banner-compression's sampled media) — this works on
// ad hoc local uploads only, and hands back a path for whoever needs one to
// paste in manually; nothing in the app calls it automatically.
export default function ImageCropDevPage() {
	return <ImageCropTool />;
}
