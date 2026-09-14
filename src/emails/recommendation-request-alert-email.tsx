import {
	Body,
	Button,
	Container,
	Head,
	Html,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import { EMAIL_TAILWIND_CONFIG } from "./theme";

type Props = {
	requesterName: string;
	message: string;
	requestUrl: string;
};

// Internal ops alert, not a user-facing digest — no locale/dict, matches how
// admin pages elsewhere in the app are English-only.
export default function RecommendationRequestAlertEmail({
	requesterName,
	message,
	requestUrl,
}: Props) {
	return (
		<Tailwind config={EMAIL_TAILWIND_CONFIG}>
			<Html>
				<Head />
				<Preview>{`${requesterName} wants a recommendation`}</Preview>
				<Body className="m-0 bg-bg-2 font-sans">
					<Container className="mx-auto w-full max-w-[600px] p-6">
						<Section className="rounded-lg border border-stroke bg-bg p-6">
							<Text className="m-0 mb-4 text-[15px] text-fg">
								<strong>{requesterName}</strong> asked for a recommendation:
							</Text>
							<Text className="m-0 mb-6 whitespace-pre-wrap text-[14px] text-fg-2">
								{message}
							</Text>
							<Button
								href={requestUrl}
								className="inline-block rounded-lg bg-brand px-6 py-3 text-[14px] font-semibold text-brand-ink">
								View request
							</Button>
						</Section>
					</Container>
				</Body>
			</Html>
		</Tailwind>
	);
}
