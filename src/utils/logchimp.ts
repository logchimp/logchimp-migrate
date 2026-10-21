import { normalizeBaseUrl, requestJson } from "./http";
import { CliError } from "./types";

export interface IPost {
  postId: string;
  title: string;
  slug: string;
  slugId: string;
  contentMarkdown: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  boardId: string;
  roadmap_id: string;
}

export interface IBoard {
  boardId: string;
  name: string;
  url: string;
  color: string;
  createdAt: Date;
}

export interface IBoardDetail extends IBoard {
  post_count: string;
}

export interface IBoardPrivate extends IBoardDetail {
  display: boolean;
  view_voters: boolean;
}

/**
 * Minimal LogChimp API client (<host>/api/v1, JWT bearer auth).
 */
export class LogChimpClient {
  private token = "";
  readonly apiUrl: string;

  constructor(siteUrl: string) {
    const base = normalizeBaseUrl(siteUrl);
    this.apiUrl = base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  }

  setToken(token: string) {
    this.token = token;
  }

  private call<T>(method: string, path: string, body?: unknown) {
    return requestJson<T>(`${this.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async login(email: string, password: string): Promise<void> {
    const res = await this.call<{ user?: { authToken?: string } }>(
      "POST",
      "/auth/login",
      { email, password },
    );
    const token = res.user?.authToken;
    if (!token)
      throw new CliError("LogChimp login succeeded but no token was returned.");
    this.token = token;
  }

  async listBoards(): Promise<IBoardPrivate[]> {
    const res = await this.call<{
      boards?: IBoardPrivate[];
    }>("GET", "/boards");
    return res.boards ?? [];
  }

  async createBoard(name: string): Promise<IBoardPrivate> {
    const res = await this.call<{
      board?: IBoardPrivate;
    }>("POST", "/boards", { name });
    if (!res.board?.boardId)
      throw new CliError(`Could not create board "${name}".`);
    return res.board;
  }

  async createPost(input: {
    title: string;
    contentMarkdown: string;
    boardId?: string;
  }): Promise<IPost> {
    const res = await this.call<{ post?: IPost }>("POST", "/posts", input);
    if (!res.post?.postId)
      throw new CliError(`Could not create post "${input.title}".`);
    return res.post;
  }
}
