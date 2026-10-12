"use client";
import { SyntheticEvent, useEffect, useRef, useState } from "react";
import { Clickable } from "@/components/ui/clickable";
import styles from "./digest.module.sass";
import { DigestBannerForm } from "./digest-banner-form";
import { DigestBannerOverride } from "./digest-banner-actions";
import { DigestSendPanel } from "./digest-send-panel";
import { DigestReviewsPanel } from "./digest-reviews-panel";

type Props = {
	initial: DigestBannerOverride;
};

const PREVIEW_SRC = "/api/admin/digest-preview";
// Email layout width plus the iframe border; the preview renders at this size, then scales.
const PREVIEW_WIDTH = 602;

// previewKey busts the iframe's cache after a save — src alone wouldn't
// reload since the URL never changes.
export function DigestPageClient({ initial }: Props) {
	const [previewKey, setPreviewKey] = useState(0);
	const [reviewsKey, setReviewsKey] = useState(0);
	const frameBoxRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);
	const [contentHeight, setContentHeight] = useState(900);

	// Shrinks the native-width preview to fit the column, never enlarging it.
	useEffect(() => {
		const box = frameBoxRef.current;
		if (!box) return;
		const observer = new ResizeObserver(([entry]) => {
			if (entry) setScale(Math.min(1, entry.contentRect.width / PREVIEW_WIDTH));
		});
		observer.observe(box);
		return () => observer.disconnect();
	}, []);

	// Same-origin, so the email's full height is readable; the frame grows to show all of it.
	function handleFrameLoad(e: SyntheticEvent<HTMLIFrameElement>) {
		const doc = e.currentTarget.contentDocument;
		if (doc) setContentHeight(doc.documentElement.scrollHeight);
	}

	return (
		<div className={styles.layout}>
			<div className={styles.column}>
				<h1>Digest</h1>
				<DigestReviewsPanel refreshSignal={reviewsKey} />
				<h2 className={styles.section_heading}>Banner</h2>
				<DigestBannerForm
					initial={initial}
					onSaved={() => setPreviewKey((key) => key + 1)}
					onCleared={() => {
						setPreviewKey((key) => key + 1);
						setReviewsKey((key) => key + 1);
					}}
				/>
				<DigestSendPanel />
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
				<div
					ref={frameBoxRef}
					className={styles.preview_box}
					style={{ height: contentHeight * scale }}>
					<iframe
						key={previewKey}
						src={`${PREVIEW_SRC}?v=${previewKey}`}
						className={styles.preview_frame}
						style={{
							width: PREVIEW_WIDTH,
							height: contentHeight,
							transform: `scale(${scale})`,
						}}
						onLoad={handleFrameLoad}
						title="Digest email preview"
					/>
				</div>
			</div>
		</div>
	);
}
