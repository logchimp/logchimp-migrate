import { requestJson } from "../utils/http";
import type { Source, SourceBoard, SourcePost } from "../utils/types";

const BASE = "https://canny.io/api/v1";
const PAGE_SIZE = 100;

interface CannyBoard {
  id: string;
  name: string;
}
interface CannyPost {
  id: string;
  title: string;
  details?: string | null;
  created?: string;
  status?: string;
  author?: { name?: string } | null;
}

export function createCannySource(apiKey: string): Source {
  const post = <T>(path: string, body: Record<string, unknown>) =>
    requestJson<T>(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, ...body }),
    });

  return {
    label: "Canny",

    async fetchBoards(): Promise<SourceBoard[]> {
      const { boards } = await post<{ boards: CannyBoard[] }>(
        "/boards/list",
        {},
      );
      return boards.map((b) => ({ id: b.id, name: b.name }));
    },

    async *fetchPosts(board: SourceBoard): AsyncGenerator<SourcePost> {
      let skip = 0;
      while (true) {
        const { posts, hasMore } = await post<{
          posts: CannyPost[];
          hasMore: boolean;
        }>("/posts/list", { boardID: board.id, limit: PAGE_SIZE, skip });

        for (const p of posts) {
          yield {
            id: p.id,
            boardId: board.id,
            title: p.title,
            body: p.details ?? "",
            createdAt: p.created,
            authorName: p.author?.name,
            status: p.status,
          };
        }

        if (!hasMore || posts.length === 0) break;
        skip += posts.length;
      }
    },
  };
}
