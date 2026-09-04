"use client";
import { useState } from "react";
import { Clickable } from "@/components/ui/clickable";
import styles from "./digest-banner.module.sass";
import { DigestBannerForm } from "./digest-banner-form";
import { DigestBannerOverride } from "./digest-banner-actions";

type Props = {
	initial: DigestBannerOverride;
};

const PREVIEW_SRC = "/api/admin/digest-banner-preview";

// previewKey busts the iframe's cache after a save — src alone wouldn't
// reload since the URL never changes.
export function DigestBannerPageClient({ initial }: Props) {
	const [previewKey, setPreviewKey] = useState(0);

	return (
		<div className={styles.layout}>
			<div className={styles.column}>
				<h1>Digest banner</h1>
				<DigestBannerForm
					initial={initial}
					onSaved={() => setPreviewKey((key) => key + 1)}
				/>
			</div>
			<div className={styles.column}>
				<div className={styles.header_row}>
					<h2 className={styles.preview_heading}>Preview</h2>
					<Clickable
						className={styles.refresh_button}
						onClick={() => setPreviewKey((key) => key + 1)}>
						Refresh
					</Clickable>
				</div>
				<iframe
					key={previewKey}
					src={`${PREVIEW_SRC}?v=${previewKey}`}
					className={styles.preview_frame}
					title="Digest email preview"
				/>
			</div>
		</div>
	);
}
