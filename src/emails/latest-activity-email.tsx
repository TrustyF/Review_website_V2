import {
	Body,
	Button,
	Container,
	Head,
	Html,
	Link,
	Preview,
	Row,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import { DigestBanner } from "./components/digest-banner";
import { MediaReviewCard } from "./components/media-review-card";
import { MediaMiniCard } from "./components/media-mini-card";
import { EMAIL_TAILWIND_CONFIG } from "./theme";
import { EmailFonts } from "./theme-fonts";

type ReviewProps = {
	title: string;
	mediaUrl: string;
	posterSrc: string;
	releaseYear: string | null;
	rating: number | null;
	watchedDateLabel: string | null;
	body: string | null;
};

type WatchProps = {
	title: string;
	mediaUrl: string;
	posterSrc: string;
	rating: number | null;
};

type Props = {
	bannerSrc: string | null;
	dateLabel: string;
	// Admin override from /admin/digest-banner — see send-weekly-digest.ts.
	bannerHeadline?: string | null | undefined;
	bannerSubtitle?: string | null | undefined;
	latestReview: ReviewProps | null;
	recentWatches: WatchProps[];
	activityUrl: string;
	accountUrl: string;
	unsubscribeUrl: string;
};

const SECTION_LABEL_CLASS =
	"m-0 mb-2 text-[13px] uppercase tracking-[0.03em] text-fg";

// Real dev-DB data (unfiltered — whatever the latest review/recently-rated
// happened to be when this was last refreshed), not hand-written placeholders
// — only used by `npm run email_dev`'s preview server, never by the real
// send path (send-weekly-digest.ts always passes real props).
LatestActivityEmail.PreviewProps = {
	// Reuses recentWatches' own (verified-live) Toy Story 5 poster path below
	// — a real backdrop path isn't available without a TMDB API key, and
	// background-size:cover crops any aspect ratio to fit the banner anyway.
	bannerSrc: "https://image.tmdb.org/t/p/w1280/sfQtVlIHljToOwYjhe21KPGzZWK.jpg",
	dateLabel: "September 4, 2026",
	latestReview: {
		title: "The Odyssey",
		mediaUrl: "https://example.com/media/1457",
		posterSrc:
			"https://image.tmdb.org/t/p/w500/krVa7rKCQb4OBfsr2LTJv4rTz5q.jpg",
		releaseYear: "2026",
		rating: 7,
		watchedDateLabel: "Aug 12, 2026",
		body: "This was a very fun ride!\n\nInitially I found the number of famous actors somewhat distracting, but I ended up settling into it. The performances were very strong overall.\n\nThe first third of the movie seems to want to rush a lot, and the editing felt frantic, which might just be a side-effect of how much ground it needs to cover.\nI did find myself enjoying it more once we started making the trip back, the movie slows down a lot and takes more time to appreciate the beautiful views and tortured feeling of the characters.\n\nThe suitors plotline I found to be the least interesting of the bunch. The mystical/spiritual adventure was much more engaging, I really enjoyed the weird lands and creatures they would run into. The \"sailing into hell\" sequence being a standout.\n\nWhile I saw it in IMAX, I don't believe we actually got the full frame version. Which is a shame since the nice framing seems to have been lost in the cropped version. \nIt was also very loud for some reason, which seems to be a common complaint. Sharp sounds like swords clashing forced me to cover my ears.\n\nI very much appreciated the practical effects as well. The cyclops felt a little goofy, but all other scenes benefited from it; Any of the sailing scenes in particular felt really grounded and gritty as a result.\n\nA strong addition to the Nolan library, but I can't see myself watching it again.",
	},
	recentWatches: [
		{
			title: "Toy Story 5",
			mediaUrl: "https://example.com/media/1463",
			posterSrc:
				"https://image.tmdb.org/t/p/w500/sfQtVlIHljToOwYjhe21KPGzZWK.jpg",
			rating: 8,
		},
		{
			title: "The Book of Life",
			mediaUrl: "https://example.com/media/1456",
			posterSrc:
				"https://image.tmdb.org/t/p/w500/aotTZos5KswgCryEzx2rlOjFsm1.jpg",
			rating: 7,
		},
		{
			title: "Neon Genesis Evangelion: The End of Evangelion",
			mediaUrl: "https://example.com/media/1455",
			posterSrc:
				"https://image.tmdb.org/t/p/w500/mZOAWRKbeQw5ZoXd9N6GChT2NSO.jpg",
			rating: 9,
		},
		{
			title: "The Invite",
			mediaUrl: "https://example.com/media/1454",
			posterSrc:
				"https://image.tmdb.org/t/p/w500/b7Dr8Chzse8VagexAporUu2RtLx.jpg",
			rating: 8,
		},
	],
	activityUrl: "https://example.com/activity",
	accountUrl: "https://example.com/account",
	unsubscribeUrl: "https://example.com/api/unsubscribe?token=preview",
} satisfies Props;

export default function LatestActivityEmail({
	bannerSrc,
	dateLabel,
	bannerHeadline,
	bannerSubtitle,
	latestReview,
	recentWatches,
	activityUrl,
	accountUrl,
	unsubscribeUrl,
}: Props) {
	return (
		<Tailwind config={EMAIL_TAILWIND_CONFIG}>
			<Html>
				<Head>
					<EmailFonts />
				</Head>
				<Preview>
					My latest review, plus what I&apos;ve been watching this week
				</Preview>
				<Body className="m-0 bg-bg-2 font-sans">
					<Container className="mx-auto w-full max-w-[600px]">
						<DigestBanner
							bannerSrc={bannerSrc}
							dateLabel={dateLabel}
							headline={bannerHeadline}
							subtitle={bannerSubtitle}
						/>

						<Section className="bg-bg p-6">
							<Text className="m-0 mb-6 text-[15px] text-fg-2">
								Hey! Here&apos;s what I&apos;ve been watching this week.
							</Text>

							{latestReview && (
								<>
									<Text className={SECTION_LABEL_CLASS}>Latest review</Text>
									<MediaReviewCard {...latestReview} />
								</>
							)}

							{recentWatches.length > 0 && (
								<>
									<Text className={`${SECTION_LABEL_CLASS} mt-6`}>
										Recent activity
									</Text>
									<Section>
										<Row>
											{recentWatches.map((movie) => (
												<MediaMiniCard key={movie.mediaUrl} {...movie} />
											))}
										</Row>
									</Section>
								</>
							)}

							<Section className="mt-8 text-center">
								<Button
									href={activityUrl}
									className="inline-block rounded-lg bg-brand px-6 py-3 text-[14px] font-semibold text-brand-ink">
									See more
								</Button>
							</Section>
						</Section>

						<Section className="mt-6 text-center">
							{/*<Text className="m-0 mb-2 text-[13px] text-fg-2">— Arthur</Text>*/}
							<Text className="m-0 text-[11px] text-fg-3">
								You&apos;re getting this because you signed up for updates from
								Arthur&apos;s Corner.{" "}
								<Link href={accountUrl} className="text-fg-3 underline">
									Manage your subscription
								</Link>{" "}
								·{" "}
								<Link href={unsubscribeUrl} className="text-fg-3 underline">
									Unsubscribe
								</Link>
							</Text>
						</Section>
					</Container>
				</Body>
			</Html>
		</Tailwind>
	);
}
