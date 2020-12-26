# ChurchOfJesusChrist-annotations-deno

An unofficial Deno library for interacting with the internal Annotations API of ChurchOfJesusChrist.org.

## Disclaimer

This code is licensed under the MIT license. All disclaimers in that license apply. In particular, this code involves handling raw ChurchOfJesusChrist.org user account credentials, which is inherently a security risk. Use at your own risk!

## Usage

Prerequisites:

* You must have [Deno](https://deno.land/#installation) installed.

To "log in" and get an authorization cookie, use `getChurchAuthCookie` from [`auth.ts`](./auth.ts):

```typescript
import { getChurchAuthCookie } from 'https://raw.githubusercontent.com/drmercer/ChurchOfJesusChrist-annotations-deno/main/auth.ts';

const username = 'your username';
const password = 'your password';

const cookie = await getChurchAuthCookie(username, password);
```

To use the cookie to fetch your annotations (currently only the first 10), pass it to `fetchAnnotations` from [`annotations.ts`](./annotations.ts).

```typescript
import { fetchAnnotations } from 'https://raw.githubusercontent.com/drmercer/ChurchOfJesusChrist-annotations-deno/main/annotations.ts';

const annotations = await fetchAnnotations(cookie);

console.log(annotations);
```
