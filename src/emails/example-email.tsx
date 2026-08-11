import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";

// Starter template — replace with real components as they're built. Run
// `npm run email_dev` to preview this (and anything else dropped in
// src/emails) live in a browser at http://localhost:3001.
export default function ExampleEmail() {
	return (
		<Html>
			<Head />
			<Preview>A preview of what this email is about</Preview>
			<Body style={{ backgroundColor: "#0d0d0f", fontFamily: "sans-serif" }}>
				<Container
					style={{
						backgroundColor: "#18181b",
						borderRadius: "8px",
						padding: "24px",
						maxWidth: "600px",
					}}>
					<Heading style={{ color: "#f5f5f5" }}>Review app</Heading>
					<Section>
						<Img
							src="https://image.tmdb.org/t/p/w154/nCbkOyOMTEwlEV0LtCOvCnwEONA.jpg"
							width={92}
							height={138}
							alt=""
							style={{ borderRadius: "4px" }}
						/>
						<Text style={{ color: "#e6e6e6" }}>Example content goes here.</Text>
						<Link href="https://example.com" style={{ color: "#8ab4f8" }}>
							View on the site →
						</Link>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
