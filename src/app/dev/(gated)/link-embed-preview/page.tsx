import type { Metadata } from "next";
import { LinkEmbedPreviewTool } from "./link-embed-preview-tool";

export const metadata: Metadata = { title: "Link embed preview" };

export default function LinkEmbedPreviewDevPage() {
	return <LinkEmbedPreviewTool />;
}
