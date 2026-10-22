import { requestJson } from "../utils/http";
import type {
  Source,
  SourceBoard,
  SourcePost,
  SourceRoadmap,
} from "../utils/types";

const MAX_PAGES = 1000; // safety net against endlessly repeating pages

interface AstutoBoard {
  id: number;
  name: string;
  description: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

interface AstutoPost {
  id: number;
  title: string;
  description?: string | null;
  slug: string;
  created_at?: string;
  user?: { full_name?: string } | null;
  board?: AstutoBoard | null;
  post_status?: AstutoRoadmap | null;
}

interface AstutoRoadmap {
  id: number;
  name: string;
  color: string;
  order: number;
  show_in_roadmap: boolean;
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
    return requestJson<T>(`${baseUrl}/api/v1${path}${qs ? `?${qs}` : ""}`, {
      headers,
    });
  };

  return {
    label: "Astuto",

    async fetchBoards(): Promise<SourceBoard[]> {
      const data = await get<AstutoBoard[] | { boards: AstutoBoard[] }>(
        "/boards",
      );
      const boards = Array.isArray(data) ? data : data.boards;
      return boards.map((b) => ({ id: String(b.id), name: b.name }));
    },

    async fetchRoadmaps(): Promise<SourceRoadmap[]> {
      const data = await get<AstutoRoadmap[] | { roadmaps: AstutoRoadmap[] }>(
        "/post_statuses",
      );
      const roadmaps = Array.isArray(data) ? data : data.roadmaps;
      return roadmaps.map((r) => ({
        id: String(r.id),
        name: r.name,
        color: r.color,
        order: r.order,
        display: r.show_in_roadmap,
      }));
    },

    async *fetchPosts(board: SourceBoard): AsyncGenerator<SourcePost> {
      const seen = new Set<string>();

      for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await get<
          AstutoPost[] | { posts: AstutoPost[]; total_pages?: number }
        >("/posts", { board_id: board.id, page });

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
            ...(p.post_status
              ? {
                  status: {
                    id: String(p.post_status?.id),
                    name: p.post_status?.name,
                  },
                }
              : {}),
          };
        }

        if (totalPages !== undefined && page >= totalPages) break;
      }
    },
  };
}
