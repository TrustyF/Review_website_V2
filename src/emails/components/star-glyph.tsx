import { Img } from "@react-email/components";
import { emailAssetSrc } from "../lib/email-asset";

// star-icon.tsx's own path — kept in sync by hand.
const STAR_PATH =
	"M7.89 1.2c-.34-.95-1.47-.92-1.78 0L4.97 5h-3.9C-.05 5-.39 6.15.53 6.85L3.63 9l-1.18 4.11c-.35 1.13.52 1.8 1.44 1.1L7 11.83l3.11 2.38c.92.7 1.79.03 1.44-1.1L10.37 9l3.1-2.15c.92-.7.58-1.85-.54-1.85H9.08z";

// Inline SVG for every client that renders it, with public/ui/star.png (the
// version with the baked-in shadow) as the Outlook fallback, since its Word
// engine strips <svg> outright. The two comment markers are the standard
// MSO show/hide hack — @react-email's own <Button> uses this same raw-
// comment-in-<span> technique for its own Outlook padding fix.
export function StarGlyph({ size = 12 }: { size?: number }) {
	return (
		<>
			<span dangerouslySetInnerHTML={{ __html: "<!--[if mso]>" }} />
			<Img
				src={emailAssetSrc("/ui/star.png")}
				width={size}
				height={size}
				alt="★"
				className="inline-block align-[-1px]"
			/>
			<span dangerouslySetInnerHTML={{ __html: "<![endif]-->" }} />
			<span dangerouslySetInnerHTML={{ __html: "<!--[if !mso]><!-->" }} />
			<svg
				width={size}
				height={size}
				viewBox="0 0 15 15"
				style={{ display: "inline-block", verticalAlign: "-1px" }}>
				<path
					d={STAR_PATH}
					fill="#fcca00"
					// stroke="#b88f00"
					// strokeWidth={0.2}
					strokeLinejoin="round"
				/>
			</svg>
			<span dangerouslySetInnerHTML={{ __html: "<!--<![endif]-->" }} />
		</>
	);
}
