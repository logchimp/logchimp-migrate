#!/usr/bin/env bun
import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import { LogChimpClient } from "./logchimp";
import { migrate } from "./migrate";
import { resolveConfirm, resolveSelect, resolveText } from "./prompt";
import { createAstutoSource } from "./sources/astuto";
import { normalizeBaseUrl } from "./http";
import { CliError, type Source, type SourceName } from "./types";

const VERSION = "0.1.0";

const HELP = `logchimp-migrate ${VERSION}
Migrate feedback from Canny or Astuto into LogChimp.

Usage
  logchimp-migrate [canny|astuto] [options]

Every option is optional — anything missing is asked interactively.

Source options
  --canny-api-key <key>     Canny API key          (env: CANNY_API_KEY)
  --astuto-url <url>        Astuto site URL        (env: ASTUTO_URL)
  --astuto-api-key <key>    Astuto API key         (env: ASTUTO_API_KEY)

LogChimp options
  --logchimp-url <url>      Your LogChimp site/API URL   (env: LOGCHIMP_URL)
  --token <jwt>             LogChimp auth token          (env: LOGCHIMP_TOKEN)
  --email <email>           LogChimp login email         (env: LOGCHIMP_EMAIL)
  --password <password>     LogChimp password            (env: LOGCHIMP_PASSWORD)

General
  --dry-run                 Read from source only, write nothing
  -y, --yes                 Skip confirmation prompt
  -h, --help                Show help
  -v, --version             Show version
`;

const SOURCES: Record<SourceName, string> = {
  // canny: "Canny",
  astuto: "Astuto",
};

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "canny-api-key": { type: "string" },
      "astuto-url": { type: "string" },
      "astuto-api-key": { type: "string" },
      "logchimp-url": { type: "string" },
      token: { type: "string" },
      email: { type: "string" },
      password: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      yes: { type: "boolean", short: "y", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  if (values.help) return console.log(HELP);
  if (values.version) return console.log(VERSION);

  const env = process.env;
  p.intro("logchimp-migrate");

  // --- Source -------------------------------------------------------------
  const given = positionals[0]?.toLowerCase();
  if (given && !(given in SOURCES)) {
    throw new CliError(
      `Unknown source "${given}". Supported: ${Object.keys(SOURCES).join(", ")}.`,
    );
  }
  const sourceName = await resolveSelect<SourceName>(
    given as SourceName | undefined,
    {
      message: "Which tool are you migrating from?",
      flag: "source (canny | astuto)",
      options: (Object.keys(SOURCES) as SourceName[]).map((value) => ({
        value,
        label: SOURCES[value],
      })),
    },
  );

  let source: Source;
  switch (sourceName) {
    // case "canny":
    // 	const apiKey = await resolveText(
    // 		values["canny-api-key"] ?? env.CANNY_API_KEY,
    // 		{
    // 			message: "Canny API key (Settings → API)",
    // 			secret: true,
    // 			flag: "--canny-api-key",
    // 		},
    // 	);
    // 	source = createCannySource(apiKey);
    // break
    case "astuto": {
      const url = await resolveText(values["astuto-url"] ?? env.ASTUTO_URL, {
        message: "Astuto site URL",
        placeholder: "https://feedback.example.com",
        flag: "--astuto-url",
      });
      const apiKey = await resolveText(
        values["astuto-api-key"] ?? env.ASTUTO_API_KEY,
        {
          message: "Astuto API key (leave empty if your site is public)",
          secret: true,
          optional: true,
          flag: "--astuto-api-key",
        },
      );
      source = createAstutoSource(normalizeBaseUrl(url), apiKey || undefined);
      break;
    }
    default:
      throw new CliError(
        `Unknown source "${given}". Supported: ${Object.keys(SOURCES).join(", ")}.`,
      );
  }

  // --- LogChimp (skipped on dry run) -------------------------------------
  let logchimp: LogChimpClient | undefined;
  if (!values["dry-run"]) {
    const siteUrl = await resolveText(
      values["logchimp-url"] ?? env.LOGCHIMP_URL,
      {
        message: "LogChimp URL (your API URL, e.g. https://api.example.com)",
        placeholder: "https://api.example.com",
        flag: "--logchimp-url",
      },
    );
    logchimp = new LogChimpClient(siteUrl);

    const token = values.token ?? env.LOGCHIMP_TOKEN;
    if (token) {
      logchimp.setToken(token);
    } else {
      const email = await resolveText(values.email ?? env.LOGCHIMP_EMAIL, {
        message: "LogChimp admin email",
        flag: "--email",
      });
      const password = await resolveText(
        values.password ?? env.LOGCHIMP_PASSWORD,
        {
          message: "LogChimp admin password",
          secret: true,
          flag: "--password",
        },
      );
      const s = p.spinner();
      s.start("Signing in to LogChimp");
      await logchimp.login(email, password);
      s.stop("Signed in");
    }
  }

  await migrate({
    source,
    sourceKey: sourceName,
    logchimp,
    yes: values.yes,
    confirm: (message) => resolveConfirm(values.yes, message),
  });
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  p.log.error(message);
  process.exit(1);
});
