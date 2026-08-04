import { MediaType, Prisma, Source } from "@prisma/client";
import { ComicVineVolume } from "@/server/comicvine/schema";
import {
	resolveCompany,
	resolvePerson,
	resolveRole,
} from "@/server/resolvers/entity-resolver";

type t_client = Prisma.TransactionClient;

// Replaces a comic's credits with the latest ComicVine data. ComicVine has
// no genre data on a volume (unlike TMDB/MangaDex), so this only handles
// credits. The people list is flat with no per-person role breakdown at the
// volume level (that only exists per-issue), so every person gets a single
// generic "Creator" role rather than a guessed-at Writer/Artist split.
export async function syncComicCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	volume: ComicVineVolume,
) {
	await tx.credit.deleteMany({ where: { mediaId } });

	if (volume.publisher) {
		const publisherRole = await resolveRole(tx, "Publisher", MediaType.COMIC);
		const company = await resolveCompany(
			tx,
			String(volume.publisher.id),
			Source.COMIC_VINE,
			volume.publisher.name,
			"publisher",
		);
		await tx.credit.create({
			data: { mediaId, roleId: publisherRole.id, companyId: company.id },
		});
	}

	if (volume.people?.length) {
		const creatorRole = await resolveRole(tx, "Creator", MediaType.COMIC);
		for (const p of volume.people) {
			const person = await resolvePerson(
				tx,
				String(p.id),
				Source.COMIC_VINE,
				p.name,
			);
			await tx.credit.create({
				data: { mediaId, roleId: creatorRole.id, personId: person.id },
			});
		}
	}
}
