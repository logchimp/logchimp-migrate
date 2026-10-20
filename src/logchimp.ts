import { normalizeBaseUrl, requestJson } from "./http";
import { CliError } from "./types";

/**
 * Minimal LogChimp API client (<host>/api/v1, JWT bearer auth).
 * Response shapes are read defensively; adjust here if your LogChimp
 * version differs (see https://docs.logchimp.codecarrot.net).
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

  async listBoards(): Promise<{ boardId: string; name: string }[]> {
    const res = await this.call<{
      boards?: { boardId: string; name: string }[];
    }>("GET", "/boards");
    return res.boards ?? [];
  }

  async createBoard(name: string): Promise<{ boardId: string; name: string }> {
    const res = await this.call<{
      board?: { boardId: string; name: string };
    }>("POST", "/boards", { name });
    if (!res.board?.boardId)
      throw new CliError(`Could not create board "${name}".`);
    return res.board;
  }

  async createPost(input: {
    title: string;
    contentMarkdown: string;
    boardId: string;
  }): Promise<{ postId: string }> {
    const res = await this.call<{ post?: { postId: string } }>(
      "POST",
      "/posts",
      input,
    );
    if (!res.post?.postId)
      throw new CliError(`Could not create post "${input.title}".`);
    return res.post;
  }
}
