import * as p from "@clack/prompts";
import { CliError } from "./types";

export const interactive = () =>
  Boolean(process.stdin.isTTY && process.stdout.isTTY);

function guard<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Migration cancelled.");
    process.exit(0);
  }
  return value as T;
}

interface AskOptions {
  message: string;
  placeholder?: string;
  secret?: boolean;
  optional?: boolean;
  /** Name of the flag, used in the non-interactive error message. */
  flag: string;
}

/**
 * Returns the provided value if present; otherwise prompts the user.
 * In non-interactive shells (CI, pipes) a missing required value is an error.
 */
export async function resolveText(
  value: string | undefined,
  opts: AskOptions,
): Promise<string> {
  if (value) return value;

  if (!interactive()) {
    if (opts.optional) return "";
    throw new CliError(
      `Missing ${opts.flag} (and no interactive terminal to ask for it).`,
    );
  }

  const validate = opts.optional
    ? undefined
    : (v: string | undefined) => (v?.trim() ? undefined : "This value is required");

  const answer = opts.secret
    ? await p.password({ message: opts.message, validate })
    : await p.text({
        message: opts.message,
        placeholder: opts.placeholder,
        validate,
      });

  return (guard(answer) as string).trim();
}

export async function resolveSelect<T extends string>(
  value: T | undefined,
  opts: {
    message: string;
    options: { value: T; label: string }[];
    flag: string;
  },
): Promise<T> {
  if (value) return value;
  if (!interactive()) throw new CliError(`Missing ${opts.flag}.`);
  return guard(
    await p.select({ message: opts.message, options: opts.options as never }),
  ) as T;
}

export async function resolveConfirm(
  skip: boolean,
  message: string,
): Promise<boolean> {
  if (skip) return true;
  if (!interactive())
    throw new CliError("Pass --yes to run without confirmation.");
  return guard(await p.confirm({ message })) as boolean;
}
