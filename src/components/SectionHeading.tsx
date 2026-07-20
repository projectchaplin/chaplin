import Link from "next/link";

export default function SectionHeading({
  eyebrow,
  title,
  href,
  hrefLabel = "See all",
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-1">
            {eyebrow}
          </p>
        )}
        <h2 className="reel-title text-2xl sm:text-3xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="text-sm text-grey hover:text-accent shrink-0 pb-1">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
