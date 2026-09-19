import generatedIdentity from "./identity.generated.json";

// Person entity used for this site's JSON-LD. Refreshed at build time from
// arthur_apex's public/identity.json — see src/server/maintenance/fetch-identity.ts.
export type PersonIdentity = {
	"@id": string;
	name: string;
	url: string;
	image: string;
	jobTitle: string;
	address: {
		"@type": string;
		addressLocality: string;
		addressRegion: string;
		addressCountry: string;
	};
	sameAs: string[];
};

export const personIdentity: PersonIdentity = generatedIdentity;
