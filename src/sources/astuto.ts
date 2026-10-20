import { requestJson } from "../utils/http";
import type { Source, SourceBoard, SourcePost } from "../utils/types";

/**
 * Astuto adapter.
 *
 * NOTE: endpoint paths live in one place so they are easy to adjust against
 * your Astuto version's API docs (https://docs.astuto.io).
 */
const PATHS = {
  boards: "/boards",
  posts: "/posts",
};
const MAX_PAGES = 1000; // safety net against endlessly repeating pages

interface AstutoBoard {
  id: number | string;
  name: string;
}
interface AstutoPost {
  id: number | string;
  title: string;
  description?: string | null;
  board_id?: number | string;
  created_at?: string;
  user?: { full_name?: string } | null;
  post_status?: { name?: string } | null;
}

export function createAstutoSource(baseUrl: string, apiKey?: string): Source {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const get = <T>(
    path: string,
    params: Record<string, string | number> = {},
  ) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    return requestJson<T>(`${baseUrl}${path}${qs ? `?${qs}` : ""}`, {
      headers,
    });
  };

  return {
    label: "Astuto",

    async fetchBoards(): Promise<SourceBoard[]> {
      const data = await get<AstutoBoard[] | { boards: AstutoBoard[] }>(
        PATHS.boards,
      );
      const boards = Array.isArray(data) ? data : data.boards;
      return boards.map((b) => ({ id: String(b.id), name: b.name }));
    },

    async *fetchPosts(board: SourceBoard): AsyncGenerator<SourcePost> {
      const seen = new Set<string>();

      for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await get<
          AstutoPost[] | { posts: AstutoPost[]; total_pages?: number }
        >(PATHS.posts, { board_id: board.id, page });

        const posts = Array.isArray(data) ? data : data.posts;
        const totalPages = Array.isArray(data) ? undefined : data.total_pages;

        const fresh = posts.filter((p) => !seen.has(String(p.id)));
        if (fresh.length === 0) break; // empty or repeated page => done

        for (const p of fresh) {
          seen.add(String(p.id));
          yield {
            id: String(p.id),
            boardId: board.id,
            title: p.title,
            body: p.description ?? "",
            createdAt: p.created_at,
            authorName: p.user?.full_name,
            status: p.post_status?.name,
          };
        }

        if (totalPages !== undefined && page >= totalPages) break;
      }
    },
  };
}
