/** Normalised shapes shared by every source adapter. */

export interface SourceBoard {
  id: string;
  name: string;
}

export interface SourcePost {
  id: string;
  title: string;
  body: string;
  createdAt?: string;
  authorName?: string;
  status?: {
    id?: string;
    name?: string;
  };
  boardId?: string;
}

export interface SourceRoadmap {
  id: string;
  name: string;
  color: string;
  order: number;
  display: boolean;
}

export interface Source {
  /** Human readable name, e.g. "Canny". */
  label: string;

  fetchBoards(): Promise<SourceBoard[]>;

  /** Yields posts of a board, handling pagination internally. */
  fetchPosts(board: SourceBoard): AsyncGenerator<SourcePost>;

  fetchRoadmaps: () => Promise<SourceRoadmap[]>;
}

export type SourceName =
  // | "canny"
  "astuto";

export class CliError extends Error {}
