import { assertEquals } from "https://deno.land/std@0.82.0/testing/asserts.ts";
import { buildCookieHeader, isRedirectStatus } from "./utils.ts";

// TODO add types
export async function fetchAnnotations(cookies: Record<string, string>) {
  const url = new URL('https://www.churchofjesuschrist.org/notes/api/v2/annotations');

  url.searchParams.set('notesAsHtml', 'true');
  url.searchParams.set('numberToReturn', '10');
  // url.searchParams.set('type', 'highlight');

  const res = await fetch(url.href, {
    redirect: "manual",
    headers: {
      'Cookie': buildCookieHeader(cookies),
    },
  });

  if (isRedirectStatus(res.status)) {
    console.error(`Error: annotations request redirected to ${res.headers.get("Location")}`)
  }

  assertEquals(res.status, 200);

  const json = await res.json();

  return json;
}

