import generatedIdentity from "./identity.generated.json";

// Person entity used for this site's JSON-LD. Refreshed at build time from
// arthur_apex's public/identity.json — see src/server/maintenance/fetch-identity.ts.
export type PersonIdentity = {
	name: string;
	url: string;
	image: string;
	sameAs: string[];
};

export const personIdentity: PersonIdentity = generatedIdentity;
