// src/app/api/parse-bestof-url/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new NextResponse('Invalid URL', { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
Given the URL below, fetch and parse the page content. Extract a ranked or unranked "best albums" list.
Return ONLY a CSV with the following columns and header:
rank,artist,album,year,notes

Rules:
- If the list is not ranked, leave rank blank.
- If multiple formats are present (tables, paragraphs, bullets), extract whichever clearly contains album listings.
- Year should be a 4-digit number if present.
- Notes may include edition info, "live", descriptions, or null.
- Do not include any text except the CSV itself.

URL: ${url}
`;

    const completion = await client.responses.create({
      model: "gpt-4.1",
      input: prompt,
    });

    const csv = completion.output_text;

    return NextResponse.json({ csv });
  } catch (err) {
    return new NextResponse(
      err instanceof Error ? err.message : 'Unknown error',
      { status: 500 }
    );
  }
}
// AUDIT: inspected, no changes.
