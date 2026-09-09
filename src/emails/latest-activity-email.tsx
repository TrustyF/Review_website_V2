import { existsSync, readFileSync } from "fs";
import path from "path";
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
	// Admin override from /admin/digest — see send-weekly-digest.ts.
	bannerHeadline?: string | null | undefined;
	bannerSubtitle?: string | null | undefined;
	latestReviews: ReviewProps[];
	recentWatches: WatchProps[];
	anticipatedReleases: WatchProps[];
	activityUrl: string;
	accountUrl: string;
	unsubscribeUrl: string;
};

const SECTION_LABEL_CLASS =
	"m-0 mb-2 text-left text-[13px] uppercase tracking-[0.03em] font-bold text-fg-3";

// Real current data, refreshed via `npm run seed_email_preview` — never used by the actual
// send path. Gitignored, so read at runtime, not statically imported (a prod build has no such file).
const PREVIEW_DATA_PATH = path.join(
	process.cwd(),
	"src/emails/preview-data/latest-activity-email.json",
);
if (existsSync(PREVIEW_DATA_PATH)) {
	LatestActivityEmail.PreviewProps = JSON.parse(
		readFileSync(PREVIEW_DATA_PATH, "utf-8"),
	) as Props;
}

export default function LatestActivityEmail({
	bannerSrc,
	dateLabel,
	bannerHeadline,
	bannerSubtitle,
	latestReviews,
	recentWatches,
	anticipatedReleases,
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
							{/*<Text className="m-2 mb-5 text-center text-[15px] text-fg-2">*/}
							{/*	Hey! Here&apos;s what I&apos;ve been watching this week.*/}
							{/*</Text>*/}

							<Section>
								{latestReviews.length > 0 && (
									<Section>
										<Text className={SECTION_LABEL_CLASS}>Latest reviews</Text>
										{latestReviews.map((review, index) => (
											<Section
												key={review.mediaUrl}
												className={index > 0 ? "mt-2" : undefined}>
												<MediaReviewCard {...review} />
											</Section>
										))}
									</Section>
								)}

								{recentWatches.length > 0 && (
									<>
										<Section
											className={
												latestReviews.length > 0 ? "mt-12" : undefined
											}>
											<Text className={`${SECTION_LABEL_CLASS}`}>
												Recent activity
											</Text>
											<Row align="left" width="auto">
												{recentWatches.map((movie) => (
													<MediaMiniCard key={movie.mediaUrl} {...movie} />
												))}
											</Row>
										</Section>
									</>
								)}

								{anticipatedReleases.length > 0 && (
									<Section
										className={
											latestReviews.length > 0 || recentWatches.length > 0
												? "mt-12"
												: undefined
										}>
										<Text className={SECTION_LABEL_CLASS}>
											Anticipated releases
										</Text>
										<Row align="left" width="auto">
											{anticipatedReleases.map((movie) => (
												<MediaMiniCard
													key={movie.mediaUrl}
													{...movie}
													wrapTitle
												/>
											))}
										</Row>
									</Section>
								)}
							</Section>

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
