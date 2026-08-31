import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	Row,
	Section,
	Text,
} from "@react-email/components";
import { MediaReviewCard } from "./components/media-review-card";
import { MediaMiniCard } from "./components/media-mini-card";

// Sample data only — not wired to the database yet; a real sending script
// will query latest review/recent watches and pass them as props instead.
// Poster paths are real TMDB hashes, kept accurate since a wrong one 404s silently.
const SAMPLE_LATEST_REVIEW = {
	title: "Ghostbusters",
	mediaUrl: "https://example.com/media/5",
	posterSrc: "https://image.tmdb.org/t/p/w342/7E8nLijS9AwwUEPu2oFYOVKhdFA.jpg",
	releaseYear: "1984",
	rating: 9,
	watchedDateLabel: "Aug 8, 2026",
	body: "They're here to save the world, and honestly they mostly succeed.\n\nGreat mix of comedy and just enough horror to keep it interesting — ||the librarian ghost at the start is still the best scare in the whole thing||. [Great writeup on the practical effects](https://example.com) if you want the technical side.",
};

const SAMPLE_RECENT_WATCHES = [
	{
		title: "Oldboy",
		mediaUrl: "https://example.com/media/481",
		posterSrc: "https://image.tmdb.org/t/p/w342/pWDtjs568ZfOTMbURQBYuT4Qxka.jpg",
		rating: 9.5,
	},
	{
		title: "The Shining",
		mediaUrl: "https://example.com/media/304",
		posterSrc: "https://image.tmdb.org/t/p/w342/uAR0AWqhQL1hQa69UDEbb2rE5Wx.jpg",
		rating: 9,
	},
	{
		title: "Blade Runner",
		mediaUrl: "https://example.com/media/305",
		posterSrc: "https://image.tmdb.org/t/p/w342/63N9uy8nd9j7Eog2axPQ8lbr3Wj.jpg",
		rating: 8.5,
	},
	{
		title: "Paprika",
		mediaUrl: "https://example.com/media/310",
		posterSrc: "https://image.tmdb.org/t/p/w342/nHJljo2Pi7XimYEgV9hvRchQWmg.jpg",
		rating: 8,
	},
];

const SECTION_LABEL_STYLE = {
	color: "#666666",
	fontSize: "13px",
	textTransform: "uppercase" as const,
	letterSpacing: "0.03em",
	margin: "24px 0 8px",
};

export default function LatestActivityEmail() {
	return (
		<Html>
			<Head />
			<Preview>Your latest review and what you&apos;ve watched this week</Preview>
			<Body style={{ backgroundColor: "#151315", fontFamily: "sans-serif" }}>
				<Container style={{ maxWidth: "600px", padding: "24px 0" }}>
					<Heading style={{ color: "#ededed", fontSize: "20px" }}>Review app</Heading>

					<Text style={SECTION_LABEL_STYLE}>Latest review</Text>
					<MediaReviewCard {...SAMPLE_LATEST_REVIEW} />

					<Text style={SECTION_LABEL_STYLE}>Recently watched</Text>
					<Section>
						<Row>
							{SAMPLE_RECENT_WATCHES.map((movie) => (
								<MediaMiniCard key={movie.mediaUrl} {...movie} />
							))}
						</Row>
					</Section>

					<Hr style={{ borderColor: "#333333", margin: "32px 0 16px" }} />
					<Text style={{ color: "#666666", fontSize: "11px" }}>
						You&apos;re receiving this because you subscribed to the newsletter.{" "}
						<Link href="https://example.com/account" style={{ color: "#666666" }}>
							Manage preferences
						</Link>
					</Text>
				</Container>
			</Body>
		</Html>
	);
}
