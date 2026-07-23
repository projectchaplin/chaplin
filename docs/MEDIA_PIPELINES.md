# Chaplin media production system

## Product rule

Chaplin does not expose a generic prompt box. A user chooses a production
output, Chaplin locks the actor and story inputs required by that output, and
the system advances a versioned production run through explicit review gates.

The durable unit is the actor. The atomic production unit is a five-second shot
package. Longer video is assembled from approved shot packages.

## Outputs Chaplin can deliver

| Output | Duration / format | Primary use | Publishable |
| --- | --- | --- | --- |
| Identity still | 2560 x 1440 master plus crops | Canonical actor identity | No |
| Gallery still | 16:9, 9:16, or 1:1 | Profile, casting, poster source | Yes |
| Spark | 5 seconds | Private profile audition | No |
| Punch | 15 seconds, 3 x 5-second shots | Public personality proof | Yes |
| Shot package | 5 seconds | Atomic production unit | No |
| Episode | 60 seconds, 12 x 5-second shots | Serialized microdrama | Yes |
| Spot | 30 or 60 seconds | Managed brand performance | Yes |
| Poster / thumbnail | 9:16, 16:9, and 1:1 crops | Discovery and delivery | Yes |
| Trailer / cutdown | 6, 10, or 15 seconds | Promotion | Yes |
| Delivery package | Master, captions, poster, manifest | Archive or client handoff | Yes |

Every publishable output carries a manifest with actor identity versions,
prompts, source assets, provider/model versions, generation jobs, approvals,
rights context, and final checks.

## Shared production gates

1. **Brief lock** - output type, audience promise, platform, aspect ratio,
   language, rights, cast, and story intent are fixed.
2. **Continuity lock** - actor identity, wardrobe, props, location, time of day,
   screen direction, and continuity-in are resolved.
3. **Shot plan** - each five-second unit has separate action, camera, lighting,
   dialogue, SFX, room tone, and continuity-out instructions.
4. **Reference frame** - Seedream creates the exact first frame from the
   featured actor identity assets. A human or QC policy approves identity,
   anatomy, wardrobe, blocking, and composition.
5. **Motion plate** - Seedance animates the approved frame. It remains silent;
   biography and audio instructions never enter the video prompt.
6. **Audio stems** - locked-voice dialogue, SFX, room tone, and theme are
   generated or selected independently and attached to the exact shot.
7. **Shot mix** - stems are aligned to the five-second timeline, ducked, limited,
   and normalized. The result is muxed with the motion plate.
8. **Shot QC** - identity, lip timing where applicable, continuity, duration,
   frame rate, loudness, clipping, and content/rights checks must pass.
9. **Approval** - one take becomes the selected shot. Rejected takes remain in
   lineage and can be compared or retried.
10. **Assembly** - only approved shots are concatenated in order. Captions,
    mastering, thumbnails, C2PA/provenance where supported, and the final
    manifest are produced.

## Shot package

The shot package is the only path to story video:

`plan-lock -> reference-frame -> reference-review -> motion-plate -> dialogue
-> sfx -> room-tone -> shot-mix -> technical-qc -> creative-review`

Required results:

- one approved first frame;
- one silent five-second video plate;
- zero or one dialogue stem from a locked actor voice;
- zero or more SFX stems;
- one room-tone stem;
- optional theme stem reference;
- one mixed audio stem;
- one final five-second shot video;
- one QC report and one approval decision.

Retries create a new attempt under the same step. They never overwrite the
previous output. Approval promotes the chosen assets to the shot's active asset
pointers.

## Image pipelines

### Identity still

`identity-brief -> seed/source upload -> image-generation -> identity-qc ->
human-approval -> crop-pack -> identity-lock`

Identity QC is strict: face geometry, apparent age, skin, hair, body
proportions, and signature wardrobe must remain stable. An identity still may
become a canonical reference only through explicit approval.

### Gallery still, poster, or thumbnail

`purpose-lock -> canonical-identity -> composition-plan -> image-generation ->
visual-qc -> crop/grade -> approval`

These outputs may change performance, blocking, environment, camera, and
lighting, but never redefine the actor.

## Video pipelines

### Spark - 5 seconds

One approved shot package that demonstrates a single readable personality
choice. It is private casting material and never enters the feed.

### Punch - 15 seconds

`promise -> 3-shot plan -> 3 approved shot packages -> assembly -> captions ->
mastering -> creative-qc -> publish approval`

The three beats are hook, pressure, and memorable choice. The Punch proves the
actor can hold character, not merely look consistent.

### Episode - 60 seconds

`series/continuity lock -> 12 approved shot packages -> ordered assembly ->
dialogue/music master -> captions -> technical-qc -> story/cliffhanger-qc ->
publish approval -> feed delivery`

Every shot changes information, pressure, or choice. Shot 12 must create a
situation-changing cliffhanger. Episode N+1 inherits Episode N's
continuity-out state.

### Brand spot - 30 or 60 seconds

`rights lock -> approved creative -> cast lock -> compliance boundaries ->
6 or 12 approved shot packages -> legal/brand review -> assembly -> mastering
-> captions/localizations -> delivery package -> client approval`

Brand users approve briefs and deliveries; Chaplin operates generation.

### Trailer / cutdown

`approved source master -> beat selection -> licensed re-edit -> caption
rewrite -> platform crop -> loudness pass -> approval`

A cutdown is derived from an approved master. It does not silently create new
actor performances.

## Audio and assembly contract

- Dialogue uses the actor's active locked ElevenLabs voice ID and records the
  model, seed, and settings.
- Video providers generate silent plates.
- Dialogue, SFX, room tone, and theme remain separate stems until shot mix.
- Shot masters are exactly five seconds at a single delivery frame rate.
- Episode assembly uses approved shot masters, never provider preview URLs.
- Default masters are 1080 x 1920 (9:16) for microdrama, H.264 video, AAC
  48 kHz audio. A 1920 x 1080 derivative is allowed when the brief requires it.
- Dialogue-led mixes target -16 LUFS integrated for social delivery, with true
  peak at or below -1 dBTP. Delivery policies can override this per platform.
- Captions are WebVTT/SRT plus a burned-in social derivative when requested.

## State model

Pipeline run:

`draft -> queued -> running -> needs_review -> approved -> assembling ->
succeeded`

Terminal alternatives are `failed` and `cancelled`. A failed step may retry up
to its configured attempt limit. A rejected review returns the affected step
to a new attempt; downstream results become stale, not deleted.

Step:

`blocked -> ready -> queued -> running -> needs_review -> approved/succeeded`

`failed` and `skipped` are explicit. Only the next dependency-complete step is
unblocked.

## Provider boundary

The pipeline owns the contract; providers are replaceable executors:

- Seedream: identity and scene frames.
- Seedance: image-to-video silent motion plates.
- ElevenLabs: locked dialogue, SFX, room tone, and theme generation.
- FFmpeg: deterministic timing, stem mix, mux, concat, captions, probes, and
  delivery encodes.
- Supabase: durable metadata, job/attempt history, review decisions, manifests,
  and archived media.

Provider callbacks or polling update a pipeline step. They do not decide which
step comes next and cannot publish an output.
