export type FeedMediaKind = "image" | "video";

export interface FeedAuthor {
  id: string;
  name: string;
  handle: string;
  avatarInitial: string;
  avatarHue: number;
  imageUrl: string | null;
}

export interface FeedReply {
  id: string;
  postId: string;
  parentReplyId: string | null;
  body: string;
  createdAt: string;
  author: FeedAuthor;
}

export interface SharedFeedPost {
  id: string;
  body: string;
  mediaKind: FeedMediaKind | null;
  mediaUrl: string | null;
  createdAt: string;
  author: FeedAuthor;
}

export interface FeedPost extends SharedFeedPost {
  sharedPostId: string | null;
  seriesId: string | null;
  episodeId: string | null;
  replyCount: number;
  reactionCount: number;
  shareCount: number;
  viewerHasLiked: boolean;
  replies: FeedReply[];
  sharedPost: SharedFeedPost | null;
}

