import { fetchTmdbById } from "@/server/tmdb/client";
import { MediaType } from "@prisma/client";
import "dotenv/config";

async function main() {
	const test = await fetchTmdbById("200", MediaType.MOVIE);
	console.log(test);
}

main()
	.catch(console.error)
	.finally(() => process.exit());
