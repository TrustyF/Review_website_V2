import { NextResponse } from "next/server";
import { searchAllMedia } from "@/components/search/search-query";

// GET (not a server action) so typing-ahead requests run in parallel and can be aborted.
export async function GET(req: Request) {
	const query = new URL(req.url).searchParams.get("q") ?? "";
	const results = await searchAllMedia(query);
	return NextResponse.json(results, {
		// private: titles depend on the locale cookie.
		headers: { "Cache-Control": "private, max-age=60" },
	});
}
