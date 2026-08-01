import "server-only";

/**
 * Server-only access to the secrets this app needs. Importing this module from
 * client code is a build error (via `server-only`), so the AI Gateway key and
 * the Treatwell session cookie can never be bundled into the browser
 * (PRD user story 17: nothing leaks to the client).
 */

/**
 * Vercel AI Gateway API key. The AI SDK's gateway provider reads
 * `AI_GATEWAY_API_KEY` from the environment automatically; this getter exists so
 * a missing key fails loudly at request time with an actionable message rather
 * than as an opaque provider error.
 */
export function aiGatewayApiKey(): string {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) {
    throw new Error(
      "AI_GATEWAY_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  return key;
}

/**
 * The full Treatwell Connect browser cookie string, sent verbatim as the
 * `Cookie` header when reading the calendar. A placeholder for now — the fetch
 * that consumes it arrives in a later ticket. Returns `undefined` when unset so
 * callers can surface a "re-paste your cookie" failure (PRD user story 16).
 */
export function treatwellCookie(): string | undefined {
  return process.env.TW_COOKIE || undefined;
}
