This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Character generation pipeline

Character profiles include a production lab for generating a persistent voice,
signature SFX, consistent scene stills, and five-second videos. Provider keys
stay on the server behind `/api/generate`.

Create `.env.local` in the project root:

```bash
ELEVEN_LABS_API_KEY=your_elevenlabs_key
SEEDANCE_API_KEY=your_byteplus_modelark_key
ELEVEN_MUSIC_USD_PER_MINUTE=0.15
```

The admin cost ledger records provider-native usage and converts each completed
job into USD, INR, and a comparable Chaplin-token amount. Media APIs do not use
LLM tokens, so Chaplin tokens are deliberately normalized at 1,000 per US
dollar. Optional rate overrides:

```bash
ELEVEN_TTS_USD_PER_1K_CHARACTERS=0.10
ELEVEN_SFX_USD_PER_MINUTE=0.12
SEEDREAM_USD_PER_IMAGE=0.04
SEEDANCE_USD_PER_SECOND=0.10
CHAPLIN_TOKENS_PER_USD=1000
USD_TO_INR_RATE=96.45
```

When `USD_TO_INR_RATE` is omitted, the server fetches the latest USD/INR rate
from Frankfurter and stores the exact rate used on each job. Seed model rates
are contract-dependent estimates until ModelArk returns an explicit billed
dollar amount, so both are configurable and labeled as estimates in the UI.

- ElevenLabs Voice Design creates three candidates. Locking one stores the
  resulting `voiceId` on that character so every future line uses the same
  voice.
- ElevenLabs Sound Effects generates the character's five-second signature
  sound.
- BytePlus ModelArk runs Seedream 4.5 directly to create a 16:9 character still
  and add it to the gallery.
- BytePlus ModelArk runs Seedance 1.5 Pro directly using that still as its
  identity reference and renders a
  five-second 720p video with synchronized audio.

Open `/characters/c-selene` to use the first configured pipeline for Meher Qureshi.

## Claude Magic Writer

The writing room at `/studio/write` can expand a short brief into a complete,
editable story, ad, or reel: title, logline, cast, creative direction, scene
objectives, visible action, and character-specific dialogue. The API key stays
server-side behind `/api/write/magic`.

Add these values to `.env.local` in the project root, and to the matching Vercel
environment when deployed:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-sonnet-5
ANTHROPIC_INPUT_USD_PER_MILLION_TOKENS=2
ANTHROPIC_OUTPUT_USD_PER_MILLION_TOKENS=10
```

`ANTHROPIC_MODEL` is optional. When no Claude key is configured, Magic Writer
uses its built-in structured draft engine so the button remains usable during
setup.

Every editable production prompt on an actor page also has a character-aware
Quick Write button. Claude usage from these actions is recorded in the admin
generation log with input tokens, output tokens, USD, INR, and normalized
Chaplin tokens. The rate variables above are optional overrides for the current
Sonnet contract.

The actor builder at `/characters/new` has the same assistance at the identity
stage. Magic Character can fill tagline, personality, voice, signature SFX, and
theme together, while each field also has its own Suggest action. If Claude is
not configured or rejects the key, the builder falls back to archetype-aware
local suggestions instead of leaving the form blank.
