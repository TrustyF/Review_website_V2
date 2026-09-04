import { Column, Img, Row, Section, Text } from "@react-email/components";
import { emailAssetSrc } from "../lib/email-asset";

// Fixed pixel width, not inline-block — Section hardcodes width="100%" as
// an HTML attribute, which Outlook honors over CSS.
export function EmailLogo() {
	return (
		<Section align="left" style={{ width: 190 }}>
			<Row>
				<Column className="w-[44px] align-middle">
					<Img
						// PNG, not icon.webp — classic Outlook desktop doesn't render WebP.
						src={emailAssetSrc("/ui/icon.png")}
						width={36}
						height={36}
						alt=""
						className="block rounded-md"
					/>
				</Column>
				<Column className="align-middle text-left">
					<Text className="m-0 text-[17px] font-extrabold leading-[1.05] text-fg">
						arthur&apos;s
						<br />
						corner
					</Text>
				</Column>
			</Row>
		</Section>
	);
}
