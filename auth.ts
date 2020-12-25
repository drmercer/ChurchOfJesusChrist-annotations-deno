import {assert, assertEquals} from 'https://deno.land/std@0.82.0/testing/asserts.ts';
import {buildCookieHeader, isRedirectStatus} from "./utils.ts";

/**
 * Do NOT copy this for use elsewhere! This file makes some very important assumptions, e.g.
 * that there aren't sensitive cookies on any subdomain of ChurchOfJesusChrist.org that need
 * to be kept from any other (sub)domain of that primary domain. Because of those assumptions,
 * this function is not suitable for general use.
 */
function getSetCookies(headers: Headers): Record<string, string> {
  const jar: any = {};
  for (const [key, value] of headers) {
    if (key.toLowerCase() === 'set-cookie') {
      const [cookieName, ...rest] = value.split('=');
      const [cookieValue] = rest.join('=').split('; ');
      jar[cookieName] = cookieValue;
    }
  }
  return jar;
}

async function submitUsername(username: string) {
  const url = new URL('https://id.churchofjesuschrist.org/api/v1/authn');

  const res = await fetch(url.href, {
    method: 'POST',
    headers: {
        "Accept": "application/json",
        "content-type": "application/json",
    },
    body: JSON.stringify({
      username,
      options: {
        warnBeforePasswordExpired: true,
        multiOptionalFactorEnroll: true
      },
    })
  });

  const json = await res.json();

  assertEquals(json.status, 'UNAUTHENTICATED');

  const passwordLink = json._embedded.factors.find((f: any) => f.factorType === "password")?._links?.verify?.href;
  const stateToken: string = json.stateToken;

  return {
    passwordLink,
    stateToken,
  };
}

async function submitPassword(link: string, stateToken: string, password: string) {
  const res = await fetch(link, {
    method: 'POST',
    headers: {
        "Accept": "application/json",
        "content-type": "application/json",
    },
    body: JSON.stringify({
      password,
      stateToken,
    }),
  });

  const json = await res.json();

  assertEquals(json.status, 'SUCCESS');

  const sessionToken: string = json.sessionToken;

  assertEquals(typeof sessionToken, 'string');

  return {
    sessionToken,
  };
}

async function submitSessionToken(sessionToken: string) {
  const url = new URL('https://id.churchofjesuschrist.org/login/sessionCookieRedirect');
  url.searchParams.set('checkAccountSetupComplete', 'true');
  url.searchParams.set('token', sessionToken);
  url.searchParams.set('redirectUrl', 'https://www.churchofjesuschrist.org');

  const res = await fetch(url.href, {
    redirect: "manual",
    headers: {
        "Accept": "*/*",
    },
    referrer: "https://id.churchofjesuschrist.org/signin/verify/okta/password",
  });

  assert(isRedirectStatus(res.status), `Expected request to redirect, but returned status ${res.status}`);

  const cookies = getSetCookies(res.headers);

  return {
    cookies,
  };
}

async function authenticateIdent() {
  const res = await fetch("https://ident.churchofjesuschrist.org/sso/json/realms/root/realms/church/authenticate?service=OktaOIDC&goto=https:////www.churchofjesuschrist.org/services/platform/v3/set-wam-cookie&authIndexType=service&authIndexValue=OktaOIDC", {
    redirect: "manual",
    headers: {
        "Accept": "application/json",
        "Accept-API-Version": "protocol=1.0,resource=2.1",
        "X-Password": "anonymous",
        "X-Username": "anonymous",
        "X-NoSession": "true",
    },
    "method": "POST",
  });

  assertEquals(res.status, 200);

  const cookies = getSetCookies(res.headers);

  const json = await res.json();

  const authId = json.authId;

  assert(authId, `$.authId is unexpectedly falsy`);

  const redirectObject = json.callbacks.find((c: any) => c.type === "RedirectCallback");

  const redirectUrl = redirectObject.output.find((o: any) => o.name === "redirectUrl").value;

  return {
    authId,
    redirectUrl,
    cookies,
  };
}

async function doAuthorizeCall(url: string, idCookies: Record<string, string>) {
  assertEquals(new URL(url).hostname, 'id.churchofjesuschrist.org');

  const res = await fetch(url, {
    redirect: "manual",
    headers: {
        "Accept": "*/*",
        "Cookie": buildCookieHeader(idCookies),
    },
  });

  assert(isRedirectStatus(res.status), `Expected redirect, got ${res.status}`);

  const responseRedirectUrl = new URL(res.headers.get("Location")!);

  assertEquals(responseRedirectUrl.hostname, 'ident.churchofjesuschrist.org');

  const state = responseRedirectUrl.searchParams.get('state');

  assert(state, `Expected to find 'state' param`);

  return {
    responseRedirectUrl,
    state,
  };
}

async function doAuthorizeCallback(identCookies: Record<string, string>, url: URL) {
  assertEquals(url.hostname, 'ident.churchofjesuschrist.org');
  assert(url.searchParams.get('code'), `Expected 'code' parameter`);

  const res = await fetch(url, {
    redirect: "manual",
    headers: {
        "Accept": "*/*",
        "Cookie": buildCookieHeader(identCookies),
    },
  });

  assert(isRedirectStatus(res.status), `Expected redirect, got ${res.status}`);

  const cookies = getSetCookies(res.headers);

  return {
    cookies,
    code: url.searchParams.get('code')!,
  };
}

async function getChurchSso(cookies: Record<string, string>, authId: string, code: string, state: string): Promise<Record<string, string>> {

  const gotoUrl = 'https:////www.churchofjesuschrist.org/services/platform/v3/set-wam-cookie';

  const url = new URL('https://ident.churchofjesuschrist.org/sso/json/realms/root/realms/church/authenticate');
  url.searchParams.set('service', 'OktaOIDC');
  url.searchParams.set('goto', gotoUrl);
  url.searchParams.set('authIndexType', 'service');
  url.searchParams.set('authIndexValue', 'OktaOIDC');
  url.searchParams.set('code', code);
  url.searchParams.set('state', state);

  const body = {
    authId,
    realm: "/church",
    service: "OktaOIDC",
    goto: gotoUrl,
    authIndexType: "service",
    authIndexValue: "OktaOIDC",
    code,
    state,
  };

  const res = await fetch(url, {
    redirect: "manual",
    "headers": {
        "Accept": "*/*",
        "Content-Type": "application/json",
        "Accept-API-Version": "protocol=1.0,resource=2.1",
        "X-Password": "anonymous",
        "X-Username": "anonymous",
        "X-NoSession": "true",
        "Cookies": buildCookieHeader(cookies),
    },
    "body": JSON.stringify(body),
    "method": "POST",
  });

  assertEquals(res.status, 200);

  const churchSSO = getSetCookies(res.headers)['ChurchSSO'];

  assert(churchSSO, `Expected to find a 'ChurchSSO' auth cookie in the result`);

  const cookie = {
    'ChurchSSO': churchSSO,
  };

  return cookie;
}

export async function getChurchAuthCookie(username: string, password: string): Promise<Record<string,string>> {
  const {passwordLink, stateToken} = await submitUsername(username);
  const {sessionToken} = await submitPassword(passwordLink, stateToken, password);
  const {cookies: idCookies} = await submitSessionToken(sessionToken);

  // At this point, the user is logged in at id.churchofjesuschrist.org.
  // Now we need to get them logged in at ident.churchofjesuschrist.org to get the "ChurchSSO"
  // auth cookie. This happens via an oauth2-like redirect flow.

  const {authId, redirectUrl, cookies: identCookies} = await authenticateIdent();
  const {responseRedirectUrl, state} = await doAuthorizeCall(redirectUrl, idCookies);
  const {cookies: identCookies2, code} = await doAuthorizeCallback(identCookies, responseRedirectUrl);

  const cookie = await getChurchSso(Object.assign({}, identCookies, identCookies2), authId, code, state);

  return cookie;
}
