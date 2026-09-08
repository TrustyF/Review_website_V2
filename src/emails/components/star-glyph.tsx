import { Img } from "@react-email/components";
import { emailAssetSrc } from "../lib/email-asset";

// PNG, not inline <svg> — most clients other than Apple/iOS Mail (Gmail,
// Outlook.com, Outlook desktop, Yahoo) strip <svg> outright, not just Outlook.
export function StarGlyph({ size = 12 }: { size?: number }) {
	return (
		<Img
			src={emailAssetSrc("/ui/star.png")}
			width={size}
			height={size}
			alt="★"
			className="inline-block align-[-1px]"
		/>
	);
}
