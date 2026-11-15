import type { components } from "@logchimp/api-ts-types";
import { normalizeBaseUrl, requestJson } from "./http";
import { CliError } from "./types";

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
    const res = await this.call<components["schemas"]["LoginResponseBody"]>(
      "POST",
      "/auth/login",
      { email, password },
    );
    const token = res.user?.authToken;
    if (!token)
      throw new CliError("LogChimp login succeeded but no token was returned.");
    this.token = token;
  }

  async listBoards(): Promise<
    components["schemas"]["GetBoardsResponseBody"]["boards"]
  > {
    const res = await this.call<components["schemas"]["GetBoardsResponseBody"]>(
      "GET",
      "/boards",
    );
    return res.boards ?? [];
  }

  async createBoard(
    name: string,
  ): Promise<components["schemas"]["BoardPrivate"]> {
    const res = await this.call<
      components["schemas"]["CreateBoardResponseBody"]
    >("POST", "/boards", { name });
    if (!res.board?.boardId)
      throw new CliError(`Could not create board "${name}".`);
    return res.board;
  }

  async createPost(
    input: components["schemas"]["CreatePostRequestBody"],
  ): Promise<components["schemas"]["CreatePostResponseBody"]["post"]> {
    const res = await this.call<
      components["schemas"]["CreatePostResponseBody"]
    >("POST", "/posts", input);
    if (!res.post?.postId)
      throw new CliError(`Could not create post "${input.title}".`);
    return res.post;
  }

  async updatePost(
    input: components["schemas"]["UpdatePostEERequestBody"],
  ): Promise<components["schemas"]["UpdatePostResponseBody"]["post"]> {
    const res = await this.call<
      components["schemas"]["UpdatePostResponseBody"]
    >("PATCH", "/posts", input);
    if (!res.post?.postId)
      throw new CliError(`Could not update post "${input.title}".`);
    return res.post;
  }

  async listRoadmaps(): Promise<
    components["schemas"]["GetFilterRoadmapsResponseBody"]["results"]
  > {
    const res = await this.call<
      components["schemas"]["GetFilterRoadmapsResponseBody"]
    >("GET", "/roadmaps");
    return res.results ?? [];
  }

  async createRoadmap(input: {
    name: string;
  }): Promise<components["schemas"]["CreateRoadmapResponseBody"]["roadmap"]> {
    const res = await this.call<
      components["schemas"]["CreateRoadmapResponseBody"]
    >("POST", "/roadmaps", input);
    if (!res.roadmap?.id)
      throw new CliError(`Could not create roadmap "${input.name}".`);
    return res.roadmap;
  }

  async updateRoadmap(
    input: components["schemas"]["UpdateRoadmapRequestBody"],
  ) {
    const res = await this.call<
      components["schemas"]["UpdateRoadmapResponseBody"]
    >("PATCH", "/roadmaps", input);
    if (!res.roadmap?.id)
      throw new CliError(`Could not update roadmap "${input.name}".`);
    return res.roadmap;
  }
}
