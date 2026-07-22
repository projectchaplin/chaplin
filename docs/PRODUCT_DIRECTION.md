# Project Chaplin product direction

## The product

**Pick an AI actor. Chaplin makes the series.**

Chaplin is a casting house and managed microdrama production system. Makers build production-ready AI actors. Casters put those actors into repeatable series. Brands choose a face and commercial window; Chaplin handles scripts, continuity, production, and delivery.

The durable asset is not a generated clip. It is an actor with a consistent identity and an audience that will follow that actor into the next story.

Chaplin's default product surface is a creator feed, not a streaming catalogue. Every non-admin account sees the same feed, creation paths, series slate, studio, and wallet.

## Creator feed

- A post contains text plus at most one image or video.
- Every post opens as a durable thread with replies and reply-to context.
- Creators can like, repost inside Chaplin, or share a public thread link.
- Works in progress, questions, scenes, and finished cuts live in one chronological conversation.
- The homepage is a short doorway into the feed; it is not a Netflix-style shelf.

## The three customer paths

### Maker

- Builds and owns an original AI actor.
- Locks face, voice, movement, wardrobe, SFX, theme, and production bible.
- Produces a 5-second Spark and 15-second Punch as casting material.
- Earns when the actor is cast.

### Caster

- Discovers actors with demonstrated personality and audience signal.
- Creates a series promise, casts the roles, and plans ordered episodes.
- Produces 60-second episodes with a mandatory cliffhanger chain.

### Brand

- Chooses an actor or commissions an exclusive one.
- Signs language, channel, category, term, and usage rights.
- Receives a managed pilot and finished campaign assets.
- Does not operate the generation pipeline directly.

## Content grammar

| Asset | Length | Owner | Job |
| --- | ---: | --- | --- |
| Spark | 5 sec | Maker | Profile audition; never a feed post |
| Punch | 15 sec | Maker | Prove personality and casting confidence |
| Episode | 60 sec | Caster / Chaplin | Advance a series and force the next-episode tap |
| Spot | 30–60 sec | Chaplin for brand | Paid commercial performance |

The public feed mixes Punches, Episodes, and Spots. It does not mix raw generation previews or Sparks.

## Production rules

1. A series owns an ordered episode chain, cast lock, story engine, and continuity state.
2. A 60-second episode contains exactly twelve five-second shot units.
3. Every shot must change information, pressure, or choice.
4. Camera, lighting, blocking, performance, and audio instructions are separate fields.
5. Video prompts animate a known identity frame; they do not repeat character biography.
6. The final shot must create a situation-changing cliffhanger, not merely tease information.
7. The next episode inherits the previous episode's continuity-out state.
8. A final episode render is assembled only from ready shot assets and records its manifest.

## Delivery sequence

### Foundation — implemented locally

- Persistent `series`, `series_cast`, `episodes`, `episode_shots`, and `episode_renders` tables.
- Series studio for one audience promise, recurring conflict, cast lock, and 60-second pilot.
- Twelve-shot planner with camera, lighting, visible action, dialogue, and audio direction.
- Persistent Supabase API and series detail/slate pages.
- Brand path changed from self-serve generation to managed production intake.
- Persistent creator posts, threaded replies, reactions, and reposts.
- One shared navigation and creator experience for Maker, Caster, and Brand accounts; Admin remains separate.

### Next: final-output pipeline

1. Generate a reference still and five-second video per shot, always using the cast member's featured identity assets.
2. Generate dialogue from the locked voice ID and attach it to the exact shot.
3. Mix dialogue, SFX, room tone, and theme stems against a loudness target.
4. Concatenate the ordered shot videos with FFmpeg and archive the render manifest.
5. Add render retry, shot replacement, and publish approval states.

### After final output works

1. Add creator follows, media completion, replay, and next-episode events to the existing feed.
2. Series lock so the next episode immediately follows the current episode.
3. Rights windows, usage contracts, invoices, and maker royalty settlement.
4. Brand pilot operations dashboard and delivery exports.

## Explicit non-goals

- Do not expose a generic text-to-video canvas as the product.
- Do not ask brands to operate production tools.
- Do not auto-create a microdrama from a character biography alone.
- Do not treat 5-second clips as the audience feed.
- Do not launch a cold actor marketplace and a cold consumer feed at the same time.
