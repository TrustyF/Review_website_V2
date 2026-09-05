import { Font } from "@react-email/components";

// Inter via Google's CSS @import, same as react-email's own demo templates
// (node_modules/react-email/../demo/emails/01-Barebone/theme-fonts.tsx).
// Many webmail clients strip @import, so the <Font> entries below register
// 400/500/600 static files as a fallback for when it doesn't run.
export function EmailFonts() {
	return (
		<>
			<style
				dangerouslySetInnerHTML={{
					__html: `@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Playfair+Display:wght@700&family=Roboto:wght@400;500;700&display=swap');`,
				}}
			/>
			<Font
				fontFamily="Playfair Display"
				fallbackFontFamily={["Georgia", "serif"]}
				webFont={{
					url: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf",
					format: "truetype",
				}}
				fontWeight={700}
				fontStyle="normal"
			/>
			<Font
				fontFamily="Roboto"
				fallbackFontFamily={["Arial", "sans-serif"]}
				webFont={{
					url: "https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmTggvWlnwk.ttf",
					format: "truetype",
				}}
				fontWeight={400}
				fontStyle="normal"
			/>
			<Font
				fontFamily="Roboto"
				fallbackFontFamily={["Arial", "sans-serif"]}
				webFont={{
					url: "https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWub2bWmTggvWlnwk.ttf",
					format: "truetype",
				}}
				fontWeight={500}
				fontStyle="normal"
			/>
			<Font
				fontFamily="Roboto"
				fallbackFontFamily={["Arial", "sans-serif"]}
				webFont={{
					url: "https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammTggvWlnwk.ttf",
					format: "truetype",
				}}
				fontWeight={700}
				fontStyle="normal"
			/>
		</>
	);
}
