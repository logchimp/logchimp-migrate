import { CliError } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch + JSON with retry on 429/5xx and readable errors. */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  retries = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }

      const text = await res.text();
      if (!res.ok) {
        throw new CliError(
          `${init.method ?? "GET"} ${url} failed (${res.status}): ${text.slice(0, 300)}`,
        );
      }
      return (text ? JSON.parse(text) : {}) as T;
    } catch (err) {
      if (err instanceof CliError) throw err;
      lastError = err;
      await sleep(1000 * 2 ** attempt);
    }
  }

  throw new CliError(
    `Request to ${url} failed after ${retries + 1} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export function normalizeBaseUrl(input: string): string {
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  return withProtocol.replace(/\/+$/, "");
}
