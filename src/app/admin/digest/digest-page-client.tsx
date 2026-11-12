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
// The email's own max width; the frame starts here and grows if the content overflows it.
const EMAIL_WIDTH = 600;
// 1px each side; the frame is border-box, so its size must include this or the email gets clipped.
const FRAME_BORDER = 2;

// previewKey busts the iframe's cache after a save — src alone wouldn't
// reload since the URL never changes.
export function DigestPageClient({ initial }: Props) {
	const [previewKey, setPreviewKey] = useState(0);
	const [reviewsKey, setReviewsKey] = useState(0);
	const frameBoxRef = useRef<HTMLDivElement>(null);
	const [boxWidth, setBoxWidth] = useState<number | null>(null);
	const [frameSize, setFrameSize] = useState({
		width: EMAIL_WIDTH + FRAME_BORDER,
		height: 900,
	});
	// Shrinks the native-size preview to fit the page, never enlarging it.
	const scale = boxWidth ? Math.min(1, boxWidth / frameSize.width) : 1;

	useEffect(() => {
		const box = frameBoxRef.current;
		if (!box) return;
		const observer = new ResizeObserver(([entry]) => {
			if (entry) setBoxWidth(entry.contentRect.width);
		});
		observer.observe(box);
		return () => observer.disconnect();
	}, []);

	// Same-origin, so the email's full size is readable; the frame grows to show all of it.
	function handleFrameLoad(e: SyntheticEvent<HTMLIFrameElement>) {
		const root = e.currentTarget.contentDocument?.documentElement;
		if (!root) return;
		setFrameSize({
			width: Math.max(EMAIL_WIDTH, root.scrollWidth) + FRAME_BORDER,
			height: root.scrollHeight + FRAME_BORDER,
		});
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
			<div
				className={styles.preview_column}
				style={{ flexBasis: frameSize.width }}>
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
					style={{ height: frameSize.height * scale }}>
					<iframe
						key={previewKey}
						src={`${PREVIEW_SRC}?v=${previewKey}`}
						className={styles.preview_frame}
						style={{
							width: frameSize.width,
							height: frameSize.height,
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
