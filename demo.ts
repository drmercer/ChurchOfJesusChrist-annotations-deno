import { fetchAnnotations } from "./annotations.ts";
import { getChurchAuthCookie } from "./auth.ts";

if (import.meta.main) {

  const {username, password} = JSON.parse(await Deno.readTextFile('./.credentials.json'));

  console.log(`Logging in as ${username}...`);

  const cookie = await getChurchAuthCookie(username, password);

  console.log(`Logged in successfully!`);

  console.log(`Loading notes...`);

  const json = await fetchAnnotations(cookie);

  for (const note of json) {
    console.log(`${note.type?.toUpperCase()} at ${note.uri}: ${note.note?.content}`);
  }
}
