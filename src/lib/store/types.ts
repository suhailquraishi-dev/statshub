import type { Period } from "@/lib/data/types";
import type { EvidenceSnapshot } from "@/lib/stats/evidence";

export type Role = "fan" | "editor";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
  suspended: boolean;
}

export type DiscussionStatus = "pending" | "published" | "locked" | "archived";

export interface PollOption {
  id: string;
  label: string;
}

export interface Poll {
  id: string;
  discussionId: string;
  options: PollOption[];
}

export interface Discussion {
  id: string;
  slug: string;
  gameId: string;
  question: string;
  /** Data-backed framing: what the numbers say, with period and sample. */
  context: string;
  statCodes: string[];
  period: Period;
  status: DiscussionStatus;
  featured: boolean;
  source: "editor" | "signal";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  poll: Poll;
}

export type CommentStatus = "visible" | "held" | "hidden" | "removed";
export type ReactionType = "agree" | "good_point";

export interface Comment {
  id: string;
  discussionId: string;
  parentId: string | null;
  authorId: string;
  body: string;
  evidence?: EvidenceSnapshot;
  status: CommentStatus;
  createdAt: string;
}

export interface Report {
  id: string;
  commentId: string;
  reporterId: string;
  reason: string;
  createdAt: string;
  status: "open" | "resolved";
}

export type ModerationActionType =
  | "approve_discussion" | "feature" | "unfeature" | "lock" | "unlock" | "archive"
  | "hide_comment" | "remove_comment" | "restore_comment" | "resolve_report" | "suspend_user";

export interface AuditEntry {
  id: string;
  actorId: string;
  action: ModerationActionType | "create_discussion" | "vote" | "comment" | "report";
  targetId: string;
  note?: string;
  at: string;
}

/** Public, display-safe view of a comment. Never includes the author's email. */
export interface CommentView {
  id: string;
  parentId: string | null;
  authorName: string;
  authorIsStaff: boolean;
  body: string;
  evidence?: EvidenceSnapshot & { state: "current" | "superseded" };
  status: CommentStatus;
  createdAt: string;
  reactions: Record<ReactionType, number>;
  myReactions: ReactionType[];
  isMine: boolean;
}

export interface PollResults {
  pollId: string;
  total: number;
  options: { id: string; label: string; votes: number; pct: number }[];
  myVote: string | null;
}
