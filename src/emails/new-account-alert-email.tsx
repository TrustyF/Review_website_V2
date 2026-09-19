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
	name: string;
	email: string;
	userUrl: string;
};

// Internal ops alert, not a user-facing digest — no locale/dict, matches how
// admin pages elsewhere in the app are English-only.
export default function NewAccountAlertEmail({ name, email, userUrl }: Props) {
	return (
		<Tailwind config={EMAIL_TAILWIND_CONFIG}>
			<Html>
				<Head />
				<Preview>{`New account: ${name}`}</Preview>
				<Body className="m-0 bg-bg-2 font-sans">
					<Container className="mx-auto w-full max-w-[600px] p-6">
						<Section className="rounded-lg border border-stroke bg-bg p-6">
							<Text className="m-0 mb-4 text-[15px] text-fg">
								A new account was just created:
							</Text>
							<Text className="m-0 mb-6 text-[14px] text-fg-2">
								<strong>{name}</strong> ({email})
							</Text>
							<Button
								href={userUrl}
								className="inline-block rounded-lg bg-brand px-6 py-3 text-[14px] font-semibold text-brand-ink">
								View account
							</Button>
						</Section>
					</Container>
				</Body>
			</Html>
		</Tailwind>
	);
}
