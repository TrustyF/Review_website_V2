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
import { MediaMiniCard } from "./components/media-mini-card";
import { EMAIL_THEME } from "./theme";

type ListGroup = {
	listId: number;
	title: string;
	listUrl: string;
	items: { title: string; mediaUrl: string; posterSrc: string; rating: number | null }[];
};

type Props = {
	lists: ListGroup[];
	accountUrl: string;
};

const SECTION_LABEL_STYLE = {
	color: EMAIL_THEME.accent1,
	fontSize: "13px",
	textTransform: "uppercase" as const,
	letterSpacing: "0.03em",
	margin: "24px 0 8px",
};

// Only used by `npm run email_dev`'s preview server — the real send path
// (send-list-add-digest.ts) always passes real props.
ListAddDigestEmail.PreviewProps = {
	lists: [
		{
			listId: 1,
			title: "Weekend picks",
			listUrl: "https://example.com/lists/1",
			items: [
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
			],
		},
	],
	accountUrl: "https://example.com/account",
} satisfies Props;

export default function ListAddDigestEmail({ lists, accountUrl }: Props) {
	return (
		<Html>
			<Head />
			<Preview>New picks added to your lists</Preview>
			<Body style={{ backgroundColor: EMAIL_THEME.background, fontFamily: EMAIL_THEME.fontFamily }}>
				<Container style={{ maxWidth: "600px", padding: "24px 0" }}>
					<Heading style={{ color: EMAIL_THEME.brand, fontSize: "20px" }}>
						Review app
					</Heading>

					{lists.map((list) => (
						<Section key={list.listId}>
							<Link href={list.listUrl} style={{ textDecoration: "none" }}>
								<Text style={SECTION_LABEL_STYLE}>{list.title}</Text>
							</Link>
							<Row>
								{list.items.map((item) => (
									<MediaMiniCard key={item.mediaUrl} {...item} />
								))}
							</Row>
						</Section>
					))}

					<Hr style={{ borderColor: EMAIL_THEME.surfaceBorder, margin: "32px 0 16px" }} />
					<Text style={{ color: EMAIL_THEME.accent1, fontSize: "11px" }}>
						You&apos;re receiving this because someone added media to a list for you.{" "}
						<Link href={accountUrl} style={{ color: EMAIL_THEME.accent1 }}>
							Manage preferences
						</Link>
					</Text>
				</Container>
			</Body>
		</Html>
	);
}
