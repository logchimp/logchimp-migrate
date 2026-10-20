import * as p from "@clack/prompts";
import { LogChimpClient } from "./logchimp";
import { State } from "./state";
import type { Source, SourceBoard, SourcePost } from "./types";

export interface MigrateOptions {
  source: Source;
  sourceKey: string;
  logchimp?: LogChimpClient; // undefined => dry run
  yes: boolean;
  confirm: (message: string) => Promise<boolean>;
}

function buildMarkdown(post: SourcePost, sourceLabel: string): string {
  const meta = [
    post.authorName && `Author: ${post.authorName}`,
    post.createdAt && `Created: ${post.createdAt}`,
    post.status && `Status: ${post.status}`,
  ].filter(Boolean);

  const footer = `\n\n---\n*Imported from ${sourceLabel}${meta.length ? ` · ${meta.join(" · ")}` : ""}*`;
  return `${post.body.trim()}${footer}`.trim();
}

export async function migrate(opts: MigrateOptions) {
  const { source, sourceKey, logchimp } = opts;
  const dryRun = !logchimp;

  // 1. Collect everything from the source
  const spin = p.spinner();
  spin.start(`Reading boards from ${source.label}`);
  const boards = await source.fetchBoards();
  spin.stop(`Found ${boards.length} board(s) in ${source.label}`);

  const postsByBoard = new Map<SourceBoard, SourcePost[]>();
  let total = 0;
  for (const board of boards) {
    spin.start(`Reading posts from "${board.name}"`);
    const posts: SourcePost[] = [];
    for await (const post of source.fetchPosts(board)) {
      posts.push(post);
      spin.message(`Reading posts from "${board.name}" (${posts.length})`);
    }
    postsByBoard.set(board, posts);
    total += posts.length;
    spin.stop(`"${board.name}": ${posts.length} post(s)`);
  }

  if (total === 0) {
    p.outro("Nothing to migrate.");
    return;
  }

  if (dryRun) {
    p.note(
      [...postsByBoard]
        .map(([b, ps]) => `${b.name}: ${ps.length} posts`)
        .join("\n"),
      "Dry run — nothing will be written",
    );
    p.outro("Dry run complete.");
    return;
  }

  const ok = await opts.confirm(
    `Import ${total} post(s) across ${boards.length} board(s) into LogChimp?`,
  );
  if (!ok) {
    p.cancel("Migration cancelled.");
    return;
  }

  // 2. Map / create boards in LogChimp
  const state = await State.load();
  const existing = new Map(
    (await logchimp.listBoards()).map((b) => [b.name.toLowerCase(), b.boardId]),
  );

  const boardIds = new Map<string, string>();
  for (const board of boards) {
    let id = existing.get(board.name.toLowerCase());
    if (!id) id = (await logchimp.createBoard(board.name)).boardId;
    boardIds.set(board.id, id);
  }

  // 3. Import posts
  const bar = p.spinner();
  let imported = 0;
  let skipped = 0;
  const failures: { id: string; title: string; error: string }[] = [];

  bar.start("Importing posts");
  for (const posts of postsByBoard.values()) {
    for (const post of posts) {
      const key = `${sourceKey}:${post.id}`;
      if (state.has(key)) {
        skipped++;
        continue;
      }
      try {
        await logchimp.createPost({
          title: post.title,
          contentMarkdown: buildMarkdown(post, source.label),
          boardId: boardIds.get(post.boardId)!,
        });
        await state.add(key);
        imported++;
      } catch (err) {
        failures.push({
          id: post.id,
          title: post.title,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      bar.message(
        `Importing posts (${imported + skipped + failures.length}/${total})`,
      );
    }
  }
  bar.stop(
    `Imported ${imported}, skipped ${skipped} already-imported, failed ${failures.length}`,
  );

  if (failures.length) {
    await Bun.write(
      "logchimp-migrate-report.json",
      JSON.stringify(failures, null, 2),
    );
    p.log.warn(
      `Failures written to logchimp-migrate-report.json. Re-run to retry them.`,
    );
  }

  p.outro("Migration finished.");
}
