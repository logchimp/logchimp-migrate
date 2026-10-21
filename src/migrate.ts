import * as p from "@clack/prompts";
import type { LogChimpClient } from "./utils/logchimp";
import { State } from "./utils/state";
import type { Source, SourceBoard, SourcePost } from "./utils/types";

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

  const spin = p.spinner();

  const boards = await collectBoards(source, spin);
  const postsByBoard = await collectPosts(source, boards, spin);
  const total = Array.from(postsByBoard.values()).reduce((sum, ps) => sum + ps.length, 0);

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

  const state = await State.load();

  const boardIds = await migrateBoards(logchimp, boards, spin);

  const { imported, skipped, failures } = await migratePosts(
    logchimp,
    state,
    sourceKey,
    source.label,
    postsByBoard,
    boardIds,
    total,
    spin,
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

async function collectBoards(source: Source, spin: ReturnType<typeof p.spinner>) {
  spin.start(`Reading boards from ${source.label}`);
  const boards = await source.fetchBoards();
  spin.stop(`Found ${boards.length} board(s) in ${source.label}`);
  return boards;
}

async function collectPosts(
  source: Source,
  boards: SourceBoard[],
  spin: ReturnType<typeof p.spinner>,
) {
  const postsByBoard = new Map<SourceBoard, SourcePost[]>();
  for (const board of boards) {
    spin.start(`Reading posts from "${board.name}"`);
    const posts: SourcePost[] = [];
    for await (const post of source.fetchPosts(board)) {
      posts.push(post);
      spin.message(`Reading posts from "${board.name}" (${posts.length})`);
    }
    postsByBoard.set(board, posts);
    spin.stop(`"${board.name}": ${posts.length} post(s)`);
  }
  return postsByBoard;
}

async function migrateBoards(
  logchimp: LogChimpClient,
  boards: SourceBoard[],
  spin: ReturnType<typeof p.spinner>,
) {
  spin.start("Mapping boards in LogChimp");

  const existing = new Map(
    (await logchimp.listBoards()).map((b) => [b.name.toLowerCase(), b.boardId]),
  );

  const boardIds = new Map<string, string>();
  for (const board of boards) {
    let id = existing.get(board.name.toLowerCase());
    if (!id) {
      id = (await logchimp.createBoard(board.name)).boardId;
    }
    boardIds.set(board.id, id);
  }

  spin.stop(`Mapped ${boardIds.size} board(s)`);
  return boardIds;
}

async function migratePosts(
  logchimp: LogChimpClient,
  state: State,
  sourceKey: string,
  sourceLabel: string,
  postsByBoard: Map<SourceBoard, SourcePost[]>,
  boardIds: Map<string, string>,
  total: number,
  spin: ReturnType<typeof p.spinner>,
) {
  spin.start("Importing posts");

  let imported = 0;
  let skipped = 0;
  const failures: { id: string; title: string; error: string }[] = [];

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
          contentMarkdown: buildMarkdown(post, sourceLabel),
          boardId: boardIds.get(post.boardId),
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
      spin.message(
        `Importing posts (${imported + skipped + failures.length}/${total})`,
      );
    }
  }

  spin.stop(
    `Imported ${imported}, skipped ${skipped} already-imported, failed ${failures.length}`,
  );

  return { imported, skipped, failures };
}
