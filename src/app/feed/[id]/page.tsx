import CreatorFeed from "@/components/CreatorFeed";

export default async function FeedThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CreatorFeed postId={id} />;
}

