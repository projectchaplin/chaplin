"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import MediaPlayer from "@/components/MediaPlayer";
import { useChaplinStore } from "@/lib/store";
import type { FeedMediaKind, FeedPost, FeedReply, SharedFeedPost } from "@/lib/feed-types";

type FeedView = "for-you" | "following";
const FOLLOWING_STORAGE_KEY = "chaplin-feed-following";

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function FeedMedia({ kind, url, compact = false }: { kind: FeedMediaKind; url: string; compact?: boolean }) {
  if (kind === "video") return <MediaPlayer src={url} label="Creator video" kind="video" compact />;
  return (
    // User-posted media can come from any HTTPS host, so it cannot use a static Next Image allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Post attachment" className={`w-full object-cover ${compact ? "max-h-56" : "max-h-[34rem]"}`} />
  );
}

function SharedPostCard({ post }: { post: SharedFeedPost }) {
  return <div className="mt-3 overflow-hidden rounded-lg border border-line bg-black/15">
    <div className="flex items-center gap-2 p-3">
      <Avatar hue={post.author.avatarHue} label={post.author.name} src={post.author.imageUrl ?? undefined} size={28} />
      <p className="min-w-0 text-xs"><span className="font-semibold">{post.author.name}</span> <span className="text-grey">{post.author.handle}</span></p>
    </div>
    {post.body && <p className="px-3 pb-3 text-sm leading-5">{post.body}</p>}
    {post.mediaKind && post.mediaUrl && <FeedMedia kind={post.mediaKind} url={post.mediaUrl} compact />}
  </div>;
}

function ReplyRow({ reply, onReply }: { reply: FeedReply; onReply: (reply: FeedReply) => void }) {
  return <div className={`relative flex gap-3 py-3 ${reply.parentReplyId ? "ml-8 border-l border-line pl-4" : ""}`}>
    <Avatar hue={reply.author.avatarHue} label={reply.author.name} src={reply.author.imageUrl ?? undefined} size={30} />
    <div className="min-w-0 flex-1">
      <p className="text-xs"><span className="font-semibold">{reply.author.name}</span> <span className="text-grey">{reply.author.handle} · {relativeTime(reply.createdAt)}</span></p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-5">{reply.body}</p>
      <button type="button" onClick={() => onReply(reply)} className="mt-1 text-[10px] font-semibold text-grey hover:text-accent">Reply</button>
    </div>
  </div>;
}

function PostCard({ post, currentUserId, refresh, expanded, following, onToggleFollow }: { post: FeedPost; currentUserId: string; refresh: () => Promise<void>; expanded?: boolean; following: boolean; onToggleFollow: (authorId: string) => void }) {
  const [replying, setReplying] = useState(Boolean(expanded));
  const [replyBody, setReplyBody] = useState("");
  const [parentReply, setParentReply] = useState<FeedReply | null>(null);
  const [busy, setBusy] = useState(false);

  async function action(url: string, body: object) {
    setBusy(true);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (response.status === 401) {
        window.location.assign("/auth");
        return;
      }
      if (!response.ok) throw new Error(data.error || "The feed could not be updated.");
      await refresh();
    } finally { setBusy(false); }
  }

  async function sendReply() {
    if (!replyBody.trim()) return;
    await action("/api/feed/replies", { postId: post.id, authorId: currentUserId, body: replyBody, parentReplyId: parentReply?.id });
    setReplyBody("");
    setParentReply(null);
    setReplying(true);
  }

  async function copyShare() {
    const url = `${window.location.origin}/feed/${post.id}`;
    if (navigator.share) await navigator.share({ title: `${post.author.name} on Chaplin`, text: post.body, url });
    else await navigator.clipboard.writeText(url);
  }

  const topReplies = post.replies.filter((reply) => !reply.parentReplyId);
  const children = new Map<string, FeedReply[]>();
  for (const reply of post.replies.filter((item) => item.parentReplyId)) {
    const list = children.get(reply.parentReplyId!) ?? [];
    list.push(reply);
    children.set(reply.parentReplyId!, list);
  }

  return <article data-feed-post={post.id} className="border-b border-line bg-paper px-4 py-6 sm:px-0">
    <div className="flex gap-3">
      <Avatar hue={post.author.avatarHue} label={post.author.name} src={post.author.imageUrl ?? undefined} size={42} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate font-semibold">{post.author.name}</span>
          <span className="truncate text-grey">{post.author.handle}</span>
          {post.author.id !== currentUserId && <button type="button" onClick={() => onToggleFollow(post.author.id)} className={`ml-auto shrink-0 text-xs font-semibold ${following ? "text-grey hover:text-ink" : "text-accent hover:text-accent-light"}`}>{following ? "Following" : "Follow"}</button>}
          <Link href={`/feed/${post.id}`} className={`${post.author.id === currentUserId ? "ml-auto" : ""} shrink-0 text-xs text-grey hover:text-accent`}>{relativeTime(post.createdAt)}</Link>
        </div>
        {post.body && <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-ink/95">{post.body}</p>}
      </div>
    </div>

    {post.sharedPost && <div className="ml-12"><SharedPostCard post={post.sharedPost} /></div>}
    {post.mediaKind && post.mediaUrl && <div className="ml-12 mt-3 overflow-hidden rounded-lg border border-line"><FeedMedia kind={post.mediaKind} url={post.mediaUrl} /></div>}

    <div className="ml-12 mt-4 grid grid-cols-4 gap-1 text-[11px] text-grey">
      <button type="button" onClick={() => setReplying((value) => !value)} className="rounded-full py-2 hover:bg-white/5 hover:text-accent">↩ {post.replyCount || "Reply"}</button>
      <button type="button" disabled={busy} onClick={() => action("/api/feed/reactions", { postId: post.id, userId: currentUserId })} className={`rounded-full py-2 hover:bg-white/5 ${post.viewerHasLiked ? "text-accent" : "hover:text-accent"}`}>♥ {post.reactionCount || "Like"}</button>
      <button type="button" disabled={busy} onClick={() => action("/api/feed", { authorId: currentUserId, sharedPostId: post.id })} className="rounded-full py-2 hover:bg-white/5 hover:text-accent">⇄ {post.shareCount || "Repost"}</button>
      <button type="button" onClick={copyShare} className="rounded-full py-2 hover:bg-white/5 hover:text-accent">↗ Share</button>
    </div>

    {(replying || expanded) && <div className="ml-12 mt-3 border-t border-line pt-3">
      {topReplies.map((reply) => <div key={reply.id}><ReplyRow reply={reply} onReply={(value) => { setParentReply(value); setReplying(true); }} />{(children.get(reply.id) ?? []).map((child) => <ReplyRow key={child.id} reply={child} onReply={(value) => { setParentReply(value); setReplying(true); }} />)}</div>)}
      <div className="mt-2 flex gap-2">
        <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} rows={2} placeholder={parentReply ? `Reply to ${parentReply.author.name}` : `Reply to ${post.author.name}`} className="min-w-0 flex-1 resize-none rounded-md border border-line bg-paper-dim px-3 py-2 text-sm focus:border-accent focus:outline-none" />
        <button type="button" disabled={busy || !replyBody.trim()} onClick={sendReply} className="self-end rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Post</button>
      </div>
    </div>}
  </article>;
}

export default function CreatorFeed({ postId }: { postId?: string }) {
  const currentUserId = useChaplinStore((state) => state.currentUserId);
  const currentUser = useChaplinStore((state) => state.users.find((user) => user.id === state.currentUserId));
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [body, setBody] = useState("");
  const [mediaKind, setMediaKind] = useState<FeedMediaKind>("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authIdentity, setAuthIdentity] = useState<{ id: string } | null>(null);
  const [view, setView] = useState<FeedView>("for-you");
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ identity: { id: string } | null }> : { identity: null })
      .then(({ identity }) => {
        if (!cancelled) {
          setAuthIdentity(identity);
          setAuthReady(true);
        }
      })
      .catch(() => { if (!cancelled) setAuthReady(true); });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ viewerId: currentUserId });
    if (postId) query.set("postId", postId);
    const response = await fetch(`/api/feed?${query}`, { cache: "no-store" });
    const data = await response.json() as { posts?: FeedPost[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not load the feed.");
    setPosts(data.posts ?? []);
  }, [currentUserId, postId]);

  useEffect(() => {
    let cancelled = false;
    try {
      const saved = window.localStorage.getItem(FOLLOWING_STORAGE_KEY);
      if (saved) {
        const savedIds = JSON.parse(saved) as string[];
        queueMicrotask(() => { if (!cancelled) setFollowing(new Set(savedIds)); });
      }
    } catch {
      // A blocked storage API should not prevent the feed from loading.
    }
    return () => { cancelled = true; };
  }, []);

  function toggleFollow(authorId: string) {
    setFollowing((current) => {
      const next = new Set(current);
      if (next.has(authorId)) next.delete(authorId);
      else next.add(authorId);
      try {
        window.localStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Keep the interaction working for this session if storage is blocked.
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ viewerId: currentUserId });
    if (postId) query.set("postId", postId);
    void fetch(`/api/feed?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { posts?: FeedPost[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load the feed.");
        return data.posts ?? [];
      })
      .then((nextPosts) => { if (!cancelled) setPosts(nextPosts); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load the feed.");
      });
    return () => { cancelled = true; };
  }, [currentUserId, postId]);

  async function publish() {
    if (!body.trim() && !mediaUrl.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authorId: currentUserId, body, mediaKind: mediaUrl.trim() ? mediaKind : undefined, mediaUrl: mediaUrl.trim() || undefined }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not publish the post.");
      setBody(""); setMediaUrl(""); setShowMedia(false);
      await load();
    } catch (publishError) { setError(publishError instanceof Error ? publishError.message : "Could not publish the post."); }
    finally { setBusy(false); }
  }

  const title = useMemo(() => postId ? "Thread" : "Feed", [postId]);
  const visiblePosts = useMemo(() => view === "following" ? posts.filter((post) => following.has(post.author.id)) : posts, [following, posts, view]);
  const suggestedCreators = useMemo(() => {
    const creators = new Map<string, FeedPost["author"]>();
    for (const post of posts) if (post.author.id !== currentUserId) creators.set(post.author.id, post.author);
    return [...creators.values()].slice(0, 4);
  }, [currentUserId, posts]);

  return <main className="mx-auto grid w-full max-w-5xl gap-10 sm:px-5 sm:py-8 lg:grid-cols-[minmax(0,42rem)_17rem]">
    <div className="min-w-0">
      <header className="border-b border-line px-4 pt-5 sm:px-0 sm:pt-0">
        {postId && <Link href="/feed" className="text-xs text-grey hover:text-accent">← Feed</Link>}
        <div className="mt-1 flex items-end justify-between gap-3 pb-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Chaplin creators</p><h1 className="reel-title text-3xl">{title}</h1></div>{!postId && <Link href="/create" className="rounded-full border border-line px-4 py-2 text-xs hover:border-accent">Write</Link>}</div>
        {!postId && <div className="flex gap-6" aria-label="Feed views">
          {(["for-you", "following"] as FeedView[]).map((option) => <button key={option} type="button" onClick={() => setView(option)} className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${view === option ? "border-accent text-ink" : "border-transparent text-grey hover:text-ink"}`}>{option === "for-you" ? "For you" : "Following"}</button>)}
        </div>}
      </header>

      {!postId && authReady && authIdentity && <section data-feed-composer className="border-b border-line bg-paper px-4 py-5 sm:px-0">
        <div className="flex gap-3">
          {currentUser && <Avatar hue={currentUser.avatarHue} label={currentUser.name} src={currentUser.imageUrl} size={42} />}
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={2000} placeholder="Share a scene, a question, a first cut, or what you learned…" className="min-w-0 flex-1 resize-none bg-transparent text-base leading-6 outline-none placeholder:text-grey" />
        </div>
        {showMedia && <div className="ml-12 mt-3 flex gap-2"><select value={mediaKind} onChange={(event) => setMediaKind(event.target.value as FeedMediaKind)} className="rounded-md border border-line bg-paper-dim px-2 text-xs"><option value="image">Image</option><option value="video">Video</option></select><input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="Paste one image or video URL" className="min-w-0 flex-1 rounded-md border border-line bg-paper-dim px-3 py-2 text-xs focus:border-accent focus:outline-none" /></div>}
        <div className="ml-12 mt-3 flex items-center justify-between gap-3 border-t border-line pt-3"><button type="button" onClick={() => setShowMedia((value) => !value)} className="text-xs text-accent">{showMedia ? "Remove attachment" : "+ One image or video"}</button><button type="button" disabled={busy || (!body.trim() && !mediaUrl.trim())} onClick={publish} className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? "Posting…" : "Post"}</button></div>
      </section>}
      {!postId && authReady && !authIdentity && <section className="border-b border-line px-4 py-6 sm:px-0">
        <p className="reel-title text-xl">Join the conversation.</p>
        <p className="mt-1 text-sm text-grey">Sign in as a Creator or Brand to post, reply, like, and repost.</p>
        <Link href="/auth" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-white">Sign in or create account</Link>
      </section>}

      {error && <p className="m-4 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm sm:mx-0">{error}</p>}
      <div>{visiblePosts.map((post) => <PostCard key={post.id} post={post} currentUserId={currentUserId} refresh={load} expanded={Boolean(postId)} following={following.has(post.author.id)} onToggleFollow={toggleFollow} />)}{!error && visiblePosts.length === 0 && <div className="border-b border-line p-10 text-center"><p className="reel-title text-xl">{view === "following" ? "Your reading list is ready for its first creator." : "Nothing has been posted here yet."}</p>{view === "following" && <button type="button" onClick={() => setView("for-you")} className="mt-3 text-sm font-semibold text-accent hover:text-accent-light">Discover creators →</button>}</div>}</div>
    </div>

    {!postId && <aside className="hidden lg:block">
      <div className="sticky top-20 space-y-6">
        <section className="rounded-xl border border-line bg-white/[0.035] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Publish on Chaplin</p>
          <h2 className="reel-title mt-3 text-2xl leading-tight">Build an audience around the work.</h2>
          <p className="mt-3 text-sm leading-6 text-grey">Share scenes, production notes, pilots, and the process behind your characters.</p>
          <Link href="/create" className="mt-5 block rounded-full bg-accent px-4 py-2.5 text-center text-xs font-semibold text-white">Start creating</Link>
        </section>
        {suggestedCreators.length > 0 && <section>
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Creators to follow</h2><span className="text-[10px] uppercase tracking-wide text-grey">From the feed</span></div>
          <div className="mt-3 divide-y divide-line border-y border-line">
            {suggestedCreators.map((creator) => <div key={creator.id} className="flex items-center gap-3 py-3">
              <Avatar hue={creator.avatarHue} label={creator.name} src={creator.imageUrl ?? undefined} size={34} />
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{creator.name}</p><p className="truncate text-[10px] text-grey">{creator.handle}</p></div>
              <button type="button" onClick={() => toggleFollow(creator.id)} className={`text-[11px] font-semibold ${following.has(creator.id) ? "text-grey" : "text-accent"}`}>{following.has(creator.id) ? "Following" : "Follow"}</button>
            </div>)}
          </div>
        </section>}
      </div>
    </aside>}
  </main>;
}
