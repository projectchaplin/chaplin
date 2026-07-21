import type {
  User,
  Character,
  Story,
  Scene,
  Line,
  Casting,
  LedgerEntry,
  ChaplinWorld,
  Archetype,
  LicenseType,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Everything below is deterministic (no Math.random / Date.now at module
// scope) so server render and client hydration always agree, and so the demo
// looks identical on every run. Stats (castings/fans/earnings) are computed
// from the castings + ledger arrays at the bottom, never hand-entered, so the
// traceability chain can never drift out of sync with itself.
// ---------------------------------------------------------------------------

export const USERS: User[] = [
  { id: "u-admin", name: "Chaplin Admin", handle: "@superadmin", roleBadges: ["admin"], avatarInitial: "S", avatarHue: 165 },
  { id: "u-meera", name: "Meera Rao", handle: "@meera", roleBadges: ["maker"], avatarInitial: "M", avatarHue: 28, imageUrl: "/unsplash/u-meera-mkpinodl-tw.webp" },
  { id: "u-arjun", name: "Arjun Dev", handle: "@arjun", roleBadges: ["caster", "maker"], avatarInitial: "A", avatarHue: 202, imageUrl: "/unsplash/u-arjun-zxr0fnwhddq.webp" },
  { id: "u-priya", name: "Priya Nair", handle: "@priya", roleBadges: ["maker", "caster"], avatarInitial: "P", avatarHue: 335, imageUrl: "/unsplash/u-priya-f49xhybpia0.webp" },
  { id: "u-kabir", name: "Kabir Singh", handle: "@kabir", roleBadges: ["caster", "maker", "brand"], avatarInitial: "K", avatarHue: 150, imageUrl: "/unsplash/u-kabir-imwizuq-jzi.webp" },
];

// license + rate baked in here; stats.{castings,fans,earnings} are placeholders
// overwritten by computeStats() below
type SeedCharacter = Pick<
  Character,
  | "id"
  | "makerId"
  | "name"
  | "archetype"
  | "tagline"
  | "personality"
  | "voiceGender"
  | "voiceDesc"
  | "sfxDesc"
  | "themeDesc"
  | "brollLine"
  | "brollScene"
  | "avatarHue"
  | "imageUrl"
  | "bannerUrl"
  | "videoUrl"
  | "galleryUrls"
  | "licenseType"
  | "royaltyRate"
  | "createdAt"
>;

const SEED_CHARACTERS: SeedCharacter[] = [
  {
    id: "c-vesper",
    makerId: "u-meera",
    name: "Rukmini Thakur",
    archetype: "villain",
    tagline: "Every heist needs a narrator. She works Chandni Chowk and prefers being the twist.",
    personality: "Cold, theatrical, allergic to being second-guessed. Speaks in half-finished threats.",
    voiceGender: "feminine",
    voiceDesc: "Low, clipped, a faint smile in every sentence",
    sfxDesc: "A single coin flip, mid-heist sting",
    themeDesc: "Moody sitar riff over a slow tabla pulse, 12s loop",
    brollLine: "The plan was yours. The ending is mine.",
    brollScene: "in a Chandni Chowk counting room at midnight, calmly catching a flipped coin as red ledger pages scatter behind her",
    avatarHue: 340,
    imageUrl: "/characters/c-vesper-avatar.webp",
    bannerUrl: "/characters/c-vesper-banner.webp",
    licenseType: "paid",
    royaltyRate: 40,
    createdAt: "2026-05-02T09:10:00Z",
  },
  {
    id: "c-rustam",
    makerId: "u-meera",
    name: "Rustam Chacha",
    archetype: "mentor",
    tagline: "Retired locksmith of Old Delhi. Unretired the day his shagird went missing.",
    personality: "Patient, dry humor, tests people before he trusts them.",
    voiceGender: "masculine",
    voiceDesc: "Gravelly, unhurried, pauses before punchlines",
    sfxDesc: "A lock tumbler clicking into place",
    themeDesc: "Warm santoor over a slow harmonium drone",
    brollLine: "Every lock tells the truth. You only have to listen.",
    brollScene: "at an Old Delhi locksmith bench, turning an antique key as a stubborn brass lock finally opens",
    avatarHue: 30,
    imageUrl: "/characters/c-rustam-avatar.webp",
    bannerUrl: "/characters/c-rustam-banner.webp",
    licenseType: "open",
    royaltyRate: 0,
    createdAt: "2026-05-03T11:40:00Z",
  },
  {
    id: "c-juno",
    makerId: "u-priya",
    name: "Bijli Kaur",
    archetype: "comic-relief",
    tagline: "Demolitions expert. Emotionally, also a demolitions expert.",
    personality: "Chaotic, loyal, narrates her own explosions.",
    voiceGender: "feminine",
    voiceDesc: "Bright, fast, cracks on the high notes",
    sfxDesc: "A firecracker fuse hissing, then a pop",
    themeDesc: "Bouncy dhol-driven brass, festival energy",
    brollLine: "Good news: the wall moved. Bad news: so did the building.",
    brollScene: "outside a bright Punjabi wedding tent, grinning as a tiny fuse sparks and colorful fabric billows from a controlled blast",
    avatarHue: 18,
    imageUrl: "/characters/c-juno-avatar.webp",
    bannerUrl: "/characters/c-juno-banner.webp",
    licenseType: "paid",
    royaltyRate: 25,
    createdAt: "2026-05-04T14:00:00Z",
  },
  {
    id: "c-selene",
    makerId: "u-priya",
    name: "Meher Qureshi",
    archetype: "love-interest",
    tagline: "A Lucknow jewel thief who only steals from people who deserve it.",
    personality: "Composed, magnetic, says more with silence than lines.",
    voiceGender: "feminine",
    voiceDesc: "Smoky, deliberate, a slight theatrical lilt",
    sfxDesc: "A glass display case sliding open",
    themeDesc: "Slow ghazal strings, a single sarangi line",
    brollLine: "You brought the men. I brought an exit.",
    brollScene: "inside a shadowy Lucknow projection booth, closing an empty jewel case before revealing a hidden escape passage",
    avatarHue: 300,
    imageUrl: "/characters/c-selene-avatar.webp",
    bannerUrl: "/characters/c-selene-banner.webp",
    videoUrl: "/characters/c-selene-video.mp4",
    galleryUrls: [
      "/characters/gallery/c-selene-gallery-1.webp",
      "/characters/gallery/c-selene-gallery-2.webp",
      "/characters/gallery/c-selene-gallery-3.webp",
      "/characters/gallery/c-selene-gallery-4.webp",
      "/characters/gallery/c-selene-gallery-5.webp",
    ],
    licenseType: "approval",
    royaltyRate: 60,
    createdAt: "2026-05-05T08:20:00Z",
  },
  {
    id: "c-bramble",
    makerId: "u-meera",
    name: "Captain Vikrant Suri",
    archetype: "hero",
    tagline: "Ex-lighthouse keeper on the Konkan coast. Now keeps watch over things that matter more.",
    personality: "Earnest, a little old-fashioned, believes in second chances.",
    voiceGender: "masculine",
    voiceDesc: "Warm, steady, carries a slight sea-worn rasp",
    sfxDesc: "A foghorn, far off and low",
    themeDesc: "Rolling waves under a solo bansuri",
    brollLine: "Storms do not ask permission. Neither do I.",
    brollScene: "inside a weathered Konkan lighthouse control room during a storm, steadying an old signal lever as sea spray strikes the windows",
    avatarHue: 205,
    imageUrl: "/characters/c-bramble-avatar.webp",
    bannerUrl: "/characters/c-bramble-banner.webp",
    licenseType: "paid",
    royaltyRate: 35,
    createdAt: "2026-05-06T16:45:00Z",
  },
  {
    id: "c-hollow",
    makerId: "u-arjun",
    name: "The Haveli Echo",
    archetype: "villain",
    tagline: "One voice. Speaks like there are several more behind it.",
    personality: "Eerily polite, never raises its voice, always already knows.",
    voiceGender: "androgynous",
    voiceDesc: "Layered whisper, echoes its own last word",
    sfxDesc: "A door creaking, then three overlapping whispers",
    themeDesc: "Detuned harmonium drone with a distant temple bell",
    brollLine: "You came alone. Alone was never an option.",
    brollScene: "at the end of a dark haveli corridor, standing perfectly still while three doorways behind the figure close one after another",
    avatarHue: 260,
    imageUrl: "/characters/c-hollow-avatar.webp",
    bannerUrl: "/characters/c-hollow-banner.webp",
    licenseType: "paid",
    royaltyRate: 50,
    createdAt: "2026-05-08T10:15:00Z",
  },
  {
    id: "c-dot",
    makerId: "u-priya",
    name: "Chhutki",
    archetype: "sidekick",
    tagline: "Pickpocket, cartographer, professional third wheel.",
    personality: "Quick-witted, a little starstruck by everyone braver than her.",
    voiceGender: "feminine",
    voiceDesc: "Light, quick, trips over her own excitement",
    sfxDesc: "A coin purse being lifted, quick and clean",
    themeDesc: "Playful flute over a running tabla shuffle",
    brollLine: "I stole the map. The route was free.",
    brollScene: "in a crowded bazaar lane, unfolding a stolen map with one hand while returning an empty coin purse with the other",
    avatarHue: 95,
    imageUrl: "/characters/c-dot-avatar.webp",
    bannerUrl: "/characters/c-dot-banner.webp",
    licenseType: "open",
    royaltyRate: 0,
    createdAt: "2026-05-09T13:00:00Z",
  },
  {
    id: "c-vosk",
    makerId: "u-meera",
    name: "Malti Amma",
    archetype: "mentor",
    tagline: "Runs the world's most dangerous mithai shop. Ask about the ladoos.",
    personality: "Warm on the surface, terrifyingly competent underneath.",
    voiceGender: "feminine",
    voiceDesc: "Soft, grandmotherly, undercut by total confidence",
    sfxDesc: "A ladle clinking against a hot kadhai",
    themeDesc: "Gentle harmonium lullaby, kitchen-warm",
    brollLine: "Eat the ladoo first. Then we discuss the explosives.",
    brollScene: "behind the counter of a warm mithai shop, placing one perfect ladoo beside a suspicious brass switch",
    avatarHue: 45,
    imageUrl: "/characters/c-vosk-avatar.webp",
    bannerUrl: "/characters/c-vosk-banner.webp",
    licenseType: "paid",
    royaltyRate: 30,
    createdAt: "2026-05-10T09:30:00Z",
  },
  {
    id: "c-wraith",
    makerId: "u-kabir",
    name: "Rehaan Fakir",
    archetype: "outsider",
    tagline: "Banished from three akhadas. Still shows up to all their reunions.",
    personality: "Guarded, sardonic, softens for exactly one person at a time.",
    voiceGender: "masculine",
    voiceDesc: "Flat, dry, a beat of hesitation before honesty",
    sfxDesc: "Prayer beads clicking, one slow breath",
    themeDesc: "Solo ektara over a long, open silence",
    brollLine: "I was invited. They simply forgot to admit it.",
    brollScene: "outside a dusty akhada at sunrise, rolling prayer beads once before stepping through a gate that has been shut against him",
    avatarHue: 170,
    imageUrl: "/characters/c-wraith-avatar.webp",
    bannerUrl: "/characters/c-wraith-banner.webp",
    licenseType: "paid",
    royaltyRate: 45,
    createdAt: "2026-05-11T12:00:00Z",
  },
  {
    id: "c-quill",
    makerId: "u-priya",
    name: "Thakur Bhanwar Singh",
    archetype: "villain",
    tagline: "Collects debts. And the occasional haveli.",
    personality: "Charming until crossed, then suddenly not charming at all.",
    voiceGender: "masculine",
    voiceDesc: "Silky, precise, enunciates threats like poetry",
    sfxDesc: "A wax seal pressed onto a promissory note",
    themeDesc: "Slow shehnai over ominous tabla rolls",
    brollLine: "A debt delayed is still a debt.",
    brollScene: "in a candlelit haveli office, pressing a wax seal onto a debt note and sliding it calmly toward camera",
    avatarHue: 15,
    imageUrl: "/characters/c-quill-avatar.webp",
    bannerUrl: "/characters/c-quill-banner.webp",
    licenseType: "approval",
    royaltyRate: 55,
    createdAt: "2026-05-12T15:20:00Z",
  },
  {
    id: "c-pip",
    makerId: "u-meera",
    name: "Guddu Mishra",
    archetype: "comic-relief",
    tagline: "Town crier. Nobody asked him to editorialize. He does anyway.",
    personality: "Overconfident, endlessly cheerful, wrong about most things.",
    voiceGender: "masculine",
    voiceDesc: "Chirpy, over-enunciated, loves a dramatic pause",
    sfxDesc: "A hand bell, rung twice, too enthusiastically",
    themeDesc: "Chirpy dholak march, slightly off-beat",
    brollLine: "Attention! I have facts. Accuracy will follow.",
    brollScene: "in a crowded town square, ringing a hand bell twice before confidently unrolling a completely blank proclamation",
    avatarHue: 55,
    imageUrl: "/characters/c-pip-avatar.webp",
    bannerUrl: "/characters/c-pip-banner.webp",
    licenseType: "open",
    royaltyRate: 0,
    createdAt: "2026-05-13T10:00:00Z",
  },
  {
    id: "c-sable",
    makerId: "u-arjun",
    name: "Rani Chauhan",
    archetype: "rebel",
    tagline: "Deserted the royal guard. Kept the armor out of spite.",
    personality: "Blunt, principled, allergic to authority of any kind.",
    voiceGender: "feminine",
    voiceDesc: "Hard-edged, clipped commands, rare cracks of warmth",
    sfxDesc: "Armor plates clinking as she turns to leave",
    themeDesc: "Driving nagada drums under a defiant string line",
    brollLine: "I kept the armor. You can keep the orders.",
    brollScene: "at a ruined fort gate, removing a royal insignia from her armor and letting it fall into the dust",
    avatarHue: 220,
    imageUrl: "/characters/c-sable-avatar.webp",
    bannerUrl: "/characters/c-sable-banner.webp",
    licenseType: "paid",
    royaltyRate: 40,
    createdAt: "2026-05-14T17:10:00Z",
  },
  {
    id: "c-astra",
    makerId: "u-priya",
    name: "Astra Sen",
    archetype: "superhero",
    tagline: "She stores the sunrise. Kolkata calls when the grid goes dark.",
    personality: "Disciplined, compassionate, and quietly funny. Treats rescue as a promise, never a performance.",
    voiceGender: "feminine",
    voiceDesc: "Grounded Bengali contralto, calm authority, warmth held just beneath every command",
    sfxDesc: "A rising solar charge resolving into a clean golden pulse",
    themeDesc: "Heroic cello and dhaak rhythm lifting into a radiant brass motif",
    brollLine: "The sun is not late. It is waiting for us.",
    brollScene: "on a rain-washed Kolkata rooftop before dawn, catching the first line of sunlight in her palm as the city grid flickers back to life",
    avatarHue: 42,
    imageUrl: "/characters/c-astra-avatar.webp",
    bannerUrl: "/characters/c-astra-banner.webp",
    licenseType: "approval",
    royaltyRate: 75,
    createdAt: "2026-07-18T08:30:00Z",
  },
  {
    id: "c-kaali-kothi",
    makerId: "u-arjun",
    name: "Kaali Kothi",
    archetype: "horror",
    tagline: "The last projectionist left the cinema. Something stayed for the second show.",
    personality: "Impossibly still, formal, and attentive. Answers questions with details no witness should know.",
    voiceGender: "androgynous",
    voiceDesc: "Close-mic near-whisper, dry and intimate, with a faint second voice arriving one beat late",
    sfxDesc: "A film reel slowing to a stop as one empty theatre seat folds down",
    themeDesc: "Bowed tanpura harmonics beneath a damaged projector rhythm and distant breath",
    brollLine: "The film ended. You did not.",
    brollScene: "inside an abandoned hill-station projection booth, turning an old brass key while a blank film begins running through the projector by itself",
    avatarHue: 275,
    imageUrl: "/characters/c-kaali-kothi-avatar.webp",
    bannerUrl: "/characters/c-kaali-kothi-banner.webp",
    licenseType: "paid",
    royaltyRate: 65,
    createdAt: "2026-07-19T23:10:00Z",
  },
];

function mkLine(characterId: string, text: string, i: number): Line {
  return {
    id: `${characterId}-l${i}`,
    characterId,
    text,
    voiceClipMock: {
      durationSec: 2 + ((text.length + i * 3) % 5),
      waveformSeed: (i * 7 + text.length * 3) % 13,
    },
  };
}

function scene(id: string, setting: string, lines: Line[]): Scene {
  return { id, setting, lines };
}

// -- Stories ---------------------------------------------------------------
// Note the deliberate reuse: Rukmini Thakur, Captain Vikrant Suri, The Haveli
// Echo, Malti Amma and Chhutki each appear in more than one story here;
// that's the "story is a showreel" loop made visible in the seed data.

const SEED_STORIES: Omit<Story, "views">[] = [
  {
    id: "s-vault",
    authorId: "u-arjun",
    title: "The Vault of Rukmini Thakur",
    logline: "A master thief's last job goes sideways when her own crew starts asking questions.",
    coverHue: 340,
    posterUrl: "/posters/s-vault-01.webp",
    createdAt: "2026-05-15T09:00:00Z",
    scenes: [
      scene("s-vault-1", "A rain-slicked rooftop above the Chandni Chowk jewellers", [
        mkLine("c-vesper", "Three guards, two cameras, one door. Romantic, really.", 1),
        mkLine("c-bramble", "You said this job was clean.", 2),
        mkLine("c-vesper", "I said it was possible. Clean was never on the table.", 3),
      ]),
      scene("s-vault-2", "Inside the vault, alarms bleeding red light", [
        mkLine("c-dot", "The second door isn't on any of the blueprints!", 1),
        mkLine("c-vesper", "Then we're the first people clever enough to find it.", 2),
        mkLine("c-bramble", "Or the first people foolish enough to open it.", 3),
      ]),
    ],
  },
  {
    id: "s-tea",
    authorId: "u-priya",
    title: "Chai With the Haveli Echo",
    logline: "An old locksmith accepts an invitation he should have refused.",
    coverHue: 260,
    posterUrl: "/posters/s-tea-01.webp",
    createdAt: "2026-05-16T11:30:00Z",
    scenes: [
      scene("s-tea-1", "A haveli sitting room lined with mirrors", [
        mkLine("c-hollow", "Sit. We so rarely have guests who leave the same size they arrived.", 1),
        mkLine("c-rustam", "I've picked locks less unsettling than that sentence.", 2),
        mkLine("c-pip", "For the record, I told him not to come.", 3),
      ]),
      scene("s-tea-2", "The haveli door, sealed from the inside", [
        mkLine("c-rustam", "There's always a second key. There's always a second key.", 1),
        mkLine("c-hollow", "We know. We watched you make three of them.", 2),
      ]),
    ],
  },
  {
    id: "s-lastreel",
    authorId: "u-kabir",
    title: "Meher's Last Reel",
    logline: "A jewel thief's final score is a debt owed to a man she never should have trusted.",
    coverHue: 300,
    posterUrl: "/posters/s-lastreel-01.webp",
    createdAt: "2026-05-17T14:15:00Z",
    scenes: [
      scene("s-lastreel-1", "A moonlit haveli courtyard, empty but for two", [
        mkLine("c-selene", "You brought the Thakur's men. I brought an exit. Guess who planned better.", 1),
        mkLine("c-quill", "I brought patience, Meher. It always outlasts an exit.", 2),
      ]),
      scene("s-lastreel-2", "The haveli rooftop, wind rising", [
        mkLine("c-wraith", "I'm not here for the Baron. I'm here because you still owe me a favor.", 1),
        mkLine("c-selene", "Then it's your lucky night. I only had one more exit planned.", 2),
        mkLine("c-quill", "How touching. Neither of you accounted for three.", 3),
      ]),
    ],
  },
  {
    id: "s-vosksable",
    authorId: "u-meera",
    title: "Malti Amma and Rani Chauhan",
    logline: "A deserter and a mithai-shop owner discover the same guild wronged them both.",
    coverHue: 45,
    posterUrl: "/posters/s-vosksable-01.webp",
    createdAt: "2026-05-18T10:45:00Z",
    scenes: [
      scene("s-vosksable-1", "A mithai shop kitchen, besan and firelight", [
        mkLine("c-vosk", "Sit, dear. Nobody plots a rebellion on an empty stomach.", 1),
        mkLine("c-sable", "I didn't come here to plot anything.", 2),
        mkLine("c-vosk", "No, but you will, once the ladoos are gone.", 3),
      ]),
      scene("s-vosksable-2", "The shop's storeroom, crates stamped with a guild seal", [
        mkLine("c-juno", "Is it just me, or does every rebellion start in someone's basement?", 1),
        mkLine("c-sable", "It's not just you. It's cheaper than a war room.", 2),
      ]),
    ],
  },
  {
    id: "s-audition",
    authorId: "u-priya",
    title: "The Second Audition",
    logline: "Rukmini Thakur takes a job in a very different kind of story, and it still isn't clean.",
    coverHue: 340,
    posterUrl: "/posters/s-audition-01.webp",
    createdAt: "2026-05-20T09:20:00Z",
    scenes: [
      scene("s-audition-1", "A Chor Bazaar pawnshop that only opens after midnight", [
        mkLine("c-vesper", "I don't usually work for flat fees. Consider this a professional courtesy.", 1),
        mkLine("c-selene", "Consider it returned, the next time I need a distraction.", 2),
      ]),
      scene("s-audition-2", "The gully behind the pawnshop", [
        mkLine("c-pip", "Extra! Extra! Two thieves, one gully, zero witnesses, allegedly!", 1),
        mkLine("c-vesper", "Guddu. Not now.", 2),
      ]),
    ],
  },
  {
    id: "s-curtain",
    authorId: "u-arjun",
    title: "Curtain Call at Basera Studios",
    logline: "Four performers who never shared a stage before find out the studio double-booked them.",
    coverHue: 205,
    posterUrl: "/posters/s-curtain-01.webp",
    createdAt: "2026-05-22T13:00:00Z",
    scenes: [
      scene("s-curtain-1", "Backstage, three dressing rooms deep", [
        mkLine("c-bramble", "I was told this dressing room was mine.", 1),
        mkLine("c-hollow", "It was. Ownership is such a temporary condition.", 2),
        mkLine("c-vosk", "Both of you, out. I need the mirror more than either of you need the argument.", 3),
      ]),
      scene("s-curtain-2", "The wings, five minutes to curtain", [
        mkLine("c-dot", "Nobody told me there'd be four leads in one scene!", 1),
        mkLine("c-bramble", "Nobody told any of us. Improvise.", 2),
      ]),
    ],
  },
];

// -- Castings ---------------------------------------------------------------
// One record per (character, story) pairing. fee mirrors the character's
// royaltyRate at the time of casting (0 for open-license characters).

interface SeedCasting {
  id: string;
  characterId: string;
  storyId: string;
  casterId: string;
  timestamp: string;
}

const rateOf = (id: string) => SEED_CHARACTERS.find((c) => c.id === id)!.royaltyRate;

const SEED_CASTINGS: SeedCasting[] = [
  // s-vault (author u-arjun)
  { id: "cast-01", characterId: "c-vesper", storyId: "s-vault", casterId: "u-arjun", timestamp: "2026-05-15T09:05:00Z" },
  { id: "cast-02", characterId: "c-bramble", storyId: "s-vault", casterId: "u-arjun", timestamp: "2026-05-15T09:05:00Z" },
  { id: "cast-03", characterId: "c-dot", storyId: "s-vault", casterId: "u-arjun", timestamp: "2026-05-15T09:06:00Z" },
  // s-tea (author u-priya)
  { id: "cast-04", characterId: "c-hollow", storyId: "s-tea", casterId: "u-priya", timestamp: "2026-05-16T11:25:00Z" },
  { id: "cast-05", characterId: "c-rustam", storyId: "s-tea", casterId: "u-priya", timestamp: "2026-05-16T11:26:00Z" },
  { id: "cast-06", characterId: "c-pip", storyId: "s-tea", casterId: "u-priya", timestamp: "2026-05-16T11:26:00Z" },
  // s-lastreel (author u-kabir)
  { id: "cast-07", characterId: "c-selene", storyId: "s-lastreel", casterId: "u-kabir", timestamp: "2026-05-17T14:10:00Z" },
  { id: "cast-08", characterId: "c-quill", storyId: "s-lastreel", casterId: "u-kabir", timestamp: "2026-05-17T14:10:00Z" },
  { id: "cast-09", characterId: "c-wraith", storyId: "s-lastreel", casterId: "u-kabir", timestamp: "2026-05-17T14:11:00Z" },
  // s-vosksable (author u-meera)
  { id: "cast-10", characterId: "c-vosk", storyId: "s-vosksable", casterId: "u-meera", timestamp: "2026-05-18T10:40:00Z" },
  { id: "cast-11", characterId: "c-sable", storyId: "s-vosksable", casterId: "u-meera", timestamp: "2026-05-18T10:41:00Z" },
  { id: "cast-12", characterId: "c-juno", storyId: "s-vosksable", casterId: "u-meera", timestamp: "2026-05-18T10:41:00Z" },
  // s-audition (author u-priya): reuses Rukmini + Meher + Guddu
  { id: "cast-13", characterId: "c-vesper", storyId: "s-audition", casterId: "u-priya", timestamp: "2026-05-20T09:15:00Z" },
  { id: "cast-14", characterId: "c-selene", storyId: "s-audition", casterId: "u-priya", timestamp: "2026-05-20T09:15:00Z" },
  { id: "cast-15", characterId: "c-pip", storyId: "s-audition", casterId: "u-priya", timestamp: "2026-05-20T09:16:00Z" },
  // s-curtain (author u-arjun): reuses Vikrant, Haveli Echo, Malti Amma, Chhutki
  { id: "cast-16", characterId: "c-bramble", storyId: "s-curtain", casterId: "u-arjun", timestamp: "2026-05-22T12:50:00Z" },
  { id: "cast-17", characterId: "c-hollow", storyId: "s-curtain", casterId: "u-arjun", timestamp: "2026-05-22T12:51:00Z" },
  { id: "cast-18", characterId: "c-vosk", storyId: "s-curtain", casterId: "u-arjun", timestamp: "2026-05-22T12:51:00Z" },
  { id: "cast-19", characterId: "c-dot", storyId: "s-curtain", casterId: "u-arjun", timestamp: "2026-05-22T12:52:00Z" },
];

// -- Ledger -------------------------------------------------------------
// Every paid casting produces a royalty entry. A handful of castings also
// carry a fan tip on top, including on open-license characters, since
// "free to cast" doesn't mean a maker can never earn from that character.

const TIP_CASTING_IDS: Record<string, number> = {
  "cast-03": 8, // Chhutki, open license, tipped anyway
  "cast-05": 12, // Rustam Chacha, open license, tipped anyway
  "cast-06": 6, // Guddu Mishra, open license, tipped anyway
  "cast-01": 15, // Rukmini Thakur, a paid casting that also drew tips
  "cast-16": 10, // Captain Vikrant Suri, reused casting drawing extra love
};

function buildLedger(castings: SeedCasting[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const cst of castings) {
    const story = SEED_STORIES.find((s) => s.id === cst.storyId)!;
    const fee = rateOf(cst.characterId);
    const makerId = SEED_CHARACTERS.find((c) => c.id === cst.characterId)!.makerId;
    if (fee > 0) {
      entries.push({
        id: `ledg-${cst.id}-royalty`,
        castingId: cst.id,
        characterId: cst.characterId,
        storyId: story.id,
        makerId,
        amount: fee,
        type: "royalty",
        timestamp: cst.timestamp,
      });
    }
    const tip = TIP_CASTING_IDS[cst.id];
    if (tip) {
      entries.push({
        id: `ledg-${cst.id}-tip`,
        castingId: cst.id,
        characterId: cst.characterId,
        storyId: story.id,
        makerId,
        amount: tip,
        type: "tip",
        timestamp: cst.timestamp,
      });
    }
  }
  return entries;
}

const LEDGER = buildLedger(SEED_CASTINGS);

function computeStats(characterId: string) {
  const castings = SEED_CASTINGS.filter((c) => c.characterId === characterId);
  const earnings = LEDGER.filter((l) => l.characterId === characterId).reduce(
    (sum, l) => sum + l.amount,
    0
  );
  const fans = 120 + castings.length * 165 + Math.floor(earnings * 1.8);
  return { castings: castings.length, fans, earnings };
}

export const CHARACTERS: Character[] = SEED_CHARACTERS.map((c) => ({
  ...c,
  stats: computeStats(c.id),
}));

export const STORIES: Story[] = SEED_STORIES.map((s) => ({
  ...s,
  views: 400 + SEED_CASTINGS.filter((c) => c.storyId === s.id).length * 260,
}));

export const CASTINGS: Casting[] = SEED_CASTINGS.map((c) => ({
  id: c.id,
  characterId: c.characterId,
  storyId: c.storyId,
  casterId: c.casterId,
  timestamp: c.timestamp,
  fee: rateOf(c.characterId),
}));

export const LEDGER_ENTRIES: LedgerEntry[] = LEDGER;

export const SEED_WORLD: ChaplinWorld = {
  users: USERS,
  characters: CHARACTERS,
  stories: STORIES,
  castings: CASTINGS,
  ledger: LEDGER_ENTRIES,
};

export const ARCHETYPES: Archetype[] = [
  "villain",
  "mentor",
  "love-interest",
  "comic-relief",
  "hero",
  "superhero",
  "horror",
  "rebel",
  "sidekick",
  "outsider",
];

export const LICENSE_TYPES: LicenseType[] = ["open", "paid", "approval"];
