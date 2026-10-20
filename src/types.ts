/** Normalised shapes shared by every source adapter. */

export interface SourceBoard {
  id: string;
  name: string;
}

export interface SourcePost {
  id: string;
  boardId: string;
  title: string;
  body: string;
  createdAt?: string;
  authorName?: string;
  status?: string;
}

export interface Source {
  /** Human readable name, e.g. "Canny". */
  label: string;

  fetchBoards(): Promise<SourceBoard[]>;

  /** Yields posts of a board, handling pagination internally. */
  fetchPosts(board: SourceBoard): AsyncGenerator<SourcePost>;
}

export type SourceName =
  // | "canny"
  "astuto";

export class CliError extends Error {}
