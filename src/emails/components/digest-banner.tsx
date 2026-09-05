import { Column, Img, Row, Section, Text } from "@react-email/components";
import { emailAssetSrc } from "../lib/email-asset";

type Props = {
	bannerSrc: string | null;
	dateLabel: string;
	// Admin override from /admin/digest-banner — default to "Weekly Digest"/dateLabel when unset.
	headline?: string | null | undefined;
	subtitle?: string | null | undefined;
};

// Tall, closer to the reference screenshot's proportions relative to a
// 600px-wide email — a short banner read as a thin strip, not a hero.
const BANNER_HEIGHT = 220;

// Two stacked CSS backgrounds (photo on the outer table cell, a top-only
// gradient on a nested one) instead of an <Img> + absolutely-positioned
// overlay — lets the logo/date row sit in normal document flow on top, no
// positioning needed. Outlook desktop ignores both backgrounds and falls
// back to the flat color; every other modern/mobile mail client renders it.
export function DigestBanner({
	bannerSrc,
	dateLabel,
	headline,
	subtitle,
}: Props) {
	return (
		<Section
			className=""
			style={{
				backgroundColor: "#1a1a1a",
				...(bannerSrc
					? {
							backgroundImage: `url(${bannerSrc})`,
							backgroundSize: "cover",
							backgroundPosition: "center",
						}
					: {}),
			}}>
			<Row>
				{/* Section's style lands on the outer <table>, not the <td> —
				vertical-align has to go on an actual table-cell, so this layer
				(height + gradient + top alignment) is a Column, not a Section. */}
				<Column
					className="px-4 pt-3 align-top"
					style={{
						backgroundImage:
							"linear-gradient(to bottom, rgba(0, 0, 0,0.55) 0%, rgba(0, 0, 0,0.25) 30%)",
						height: BANNER_HEIGHT,
						verticalAlign: "top",
					}}>
					<Row>
						<Column className="w-[170px] align-top">
							<Row>
								<Column className="w-[20px] align-middle">
									<Img
										src={emailAssetSrc("/ui/icon.png")}
										width={28}
										height={28}
										alt=""
										className="block"
									/>
								</Column>
								<Column className="pl-2 align-middle text-left">
									<Text className="m-0 text-[13px] font-extrabold leading-[1.05] text-white">
										Arthur&apos;s
										<br />
										corner
									</Text>
								</Column>
							</Row>
						</Column>
						<Column className="text-center align-top">
							<Text
								className="m-0 mt-9 font-serif text-[50px] font-bold uppercase leading-[1] text-white"
								style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.85)" }}>
								{headline || "Weekly Digest"}
							</Text>
							<Text
								className="m-0 mt-2 text-[12px] font-medium text-white"
								style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.95)" }}>
								{subtitle || dateLabel}
							</Text>
						</Column>
						<Column className="w-[170px] align-top" />
					</Row>
				</Column>
			</Row>
		</Section>
	);
}
