import type { Metadata } from "next";
import { ResponsivePreview } from "./responsive-preview";

export const metadata: Metadata = { title: "Responsive preview" };

export default function ResponsivePreviewDevPage() {
	return <ResponsivePreview />;
}
