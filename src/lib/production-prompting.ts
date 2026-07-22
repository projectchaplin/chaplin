import type { Archetype, Character, CharacterProductionBible } from "@/lib/types";

export type CharacterIdentityInput = Pick<Character, "name" | "archetype" | "tagline" | "personality" | "voiceGender"> &
  Partial<Pick<Character, "voiceDesc" | "sfxDesc" | "themeDesc" | "productionBible" | "brollLine" | "brollScene">> & {
    appearanceBrief?: string;
    worldBrief?: string;
  };

export type ShotBlueprint = {
  sceneName: string;
  dramaticBeat: string;
  hook: string;
  setting: string;
  subjectStart: string;
  actionTimeline: [string, string, string];
  facialBeat: string;
  framing: string;
  cameraAngle: string;
  lens: string;
  cameraMovement: string;
  keyLight: string;
  fillAndEdge: string;
  environmentalMotion: string;
  soundTexture: string;
  musicalArc: string;
  finalFrame: string;
  dialogue: string;
};

export type ScenePackage = {
  sceneName: string;
  hook: string;
  dialogue: string;
  image: string;
  video: string;
  sfx: string;
  theme: string;
  blueprint: ShotBlueprint;
};

type ArchetypeDirection = {
  want: string;
  need: string;
  contradiction: string;
  stakes: string;
  vulnerability: string;
  boundary: string;
  expression: string;
  pressure: string;
  gesture: string;
  movement: string;
  hook: string;
  escalation: string;
  cliffhanger: string;
  payoff: string;
  motifs: string[];
  framing: string;
  angle: string;
  lens: string;
  key: string;
  fill: string;
  edge: string;
  texture: string;
  palette: string[];
};

const DIRECTIONS: Record<Archetype, ArchetypeDirection> = {
  villain: {
    want: "control the room before anyone sees the trap",
    need: "accept that loyalty cannot be forced",
    contradiction: "offers exquisite courtesy while engineering irreversible pressure",
    stakes: "losing control exposes the fear beneath the performance",
    vulnerability: "a sincere act of trust leaves them without a script",
    boundary: "never harms a powerless person merely to prove authority",
    expression: "an unreadable half-smile with still eyes",
    pressure: "the smile disappears; the voice grows quieter and the body becomes perfectly still",
    gesture: "aligns one nearby object before making a threat",
    movement: "economical steps, squared turns, no wasted hand movement",
    hook: "begin with an apparently generous act that contains a trap",
    escalation: "every concession removes one escape route",
    cliffhanger: "reveal that the opponent already accepted the dangerous bargain",
    payoff: "force a choice between control and the one relationship they value",
    motifs: ["symmetry", "sealed objects", "reflections"],
    framing: "formal medium close-up with controlled negative space",
    angle: "eye level drifting five degrees low only when control changes hands",
    lens: "65mm portrait perspective with shallow but readable depth",
    key: "narrow warm key from frame left, motivated by a practical lamp",
    fill: "minimal cool bounce from frame right",
    edge: "thin amber edge separating the shoulders from shadow",
    texture: "polished surfaces interrupted by one imperfect detail",
    palette: ["oxblood", "aged brass", "charcoal"],
  },
  mentor: {
    want: "prepare another person for a choice they cannot make for them",
    need: "stop confusing restraint with emotional distance",
    contradiction: "patient in conversation and ruthless about avoided truth",
    stakes: "their guidance may create a successor who no longer needs them",
    vulnerability: "recognition of their own old mistake breaks the calm",
    boundary: "never takes the decisive action away from the learner",
    expression: "soft attention with one assessing eyebrow",
    pressure: "a long exhale, lowered chin, then one exact instruction",
    gesture: "turns an everyday object into a practical lesson",
    movement: "grounded weight, deliberate hands, lets others cross the frame first",
    hook: "open on the mentor quietly correcting the consequence, not the mistake",
    escalation: "remove advice and make the learner act",
    cliffhanger: "reveal that the mentor once failed the same test",
    payoff: "the learner repeats the lesson in an unexpected form",
    motifs: ["worn tools", "thresholds", "morning light"],
    framing: "two-thirds profile medium shot with space for the learner",
    angle: "calm eye-level camera",
    lens: "50mm natural perspective",
    key: "large soft daylight source from frame right",
    fill: "warm practical bounce below eye line",
    edge: "subtle window edge on hair and shoulder",
    texture: "worn wood, repaired objects, tactile dust",
    palette: ["indigo", "warm wood", "soft gold"],
  },
  "love-interest": {
    want: "be chosen without surrendering independence",
    need: "say the dangerous truth before charm turns into distance",
    contradiction: "inviting presence, fiercely guarded private life",
    stakes: "the relationship fails if either person performs instead of answering",
    vulnerability: "direct tenderness disarms their practiced wit",
    boundary: "never uses intimacy as leverage",
    expression: "composed gaze with amusement arriving before the smile",
    pressure: "breaks eye contact once, then returns with complete honesty",
    gesture: "touches a small personal token before taking an emotional risk",
    movement: "fluid turns, assured stillness, closes distance only by choice",
    hook: "open on them knowing one detail they should not know",
    escalation: "make emotional honesty conflict with the practical mission",
    cliffhanger: "end on an intimate truth that changes the alliance",
    payoff: "let independence become the reason the relationship survives",
    motifs: ["kept letters", "doorways", "shared reflections"],
    framing: "intimate medium close-up with foreground occlusion",
    angle: "eye level, camera just off the other person's eyeline",
    lens: "75mm portrait compression",
    key: "soft tungsten key through patterned glass from frame right",
    fill: "very low neutral fill preserving eye detail",
    edge: "warm practical halo on the far cheek and hair",
    texture: "embroidered fabric, glass, soft atmospheric grain",
    palette: ["deep emerald", "antique gold", "black"],
  },
  "comic-relief": {
    want: "prove the apparent fool is the person paying closest attention",
    need: "risk sincerity without hiding behind the next joke",
    contradiction: "chaotic delivery, precise situational intelligence",
    stakes: "if nobody listens, the joke becomes a warning delivered too late",
    vulnerability: "silence after a joke exposes how much they care",
    boundary: "never makes the weakest person the punchline",
    expression: "alert eyes and a smile that changes direction mid-thought",
    pressure: "the rhythm accelerates, then stops on one unexpectedly plain sentence",
    gesture: "catches or fixes a prop without interrupting the line",
    movement: "quick lateral entries, compact gestures, sudden clean stillness",
    hook: "open on a visual mistake that turns out to be deliberate",
    escalation: "let each joke solve one problem and create a larger one",
    cliffhanger: "end when the comic notices the threat before everyone else",
    payoff: "the throwaway observation becomes the winning clue",
    motifs: ["misplaced props", "near misses", "repeated threes"],
    framing: "slightly wide medium shot that leaves room for physical timing",
    angle: "eye level with a subtle off-center composition",
    lens: "35mm environmental perspective",
    key: "bright soft key motivated by an overhead shop or street source",
    fill: "clean open fill for readable expressions",
    edge: "colored practical edge from the deep background",
    texture: "busy lived-in surfaces with one strong graphic shape",
    palette: ["marigold", "teal", "warm red"],
  },
  hero: {
    want: "protect ordinary people without needing their applause",
    need: "accept help before duty becomes isolation",
    contradiction: "decisive under pressure, hesitant with personal need",
    stakes: "saving the mission while losing the person who still sees the human being",
    vulnerability: "gratitude is harder to receive than danger",
    boundary: "never trades an innocent life for a cleaner victory",
    expression: "level gaze, relaxed mouth, concern held behind the eyes",
    pressure: "checks the exits, sets the jaw once, then commits without flourish",
    gesture: "rolls one shoulder or tightens a cuff before action",
    movement: "grounded forward motion, protective positioning, turns with the torso before the head",
    hook: "open after the obvious plan has already failed",
    escalation: "make every rescue cost a tactical advantage",
    cliffhanger: "end on evidence that the protected person caused the crisis",
    payoff: "win by keeping the moral boundary that seemed impractical",
    motifs: ["open doors", "weathered metal", "held breath"],
    framing: "chest-up hero frame with meaningful environment on one side",
    angle: "eye level, never exaggerated low-angle worship",
    lens: "50mm with natural facial proportions",
    key: "hard-soft motivated key from frame left, shaped through a doorway",
    fill: "cool low-level environmental fill",
    edge: "restrained warm rim from a practical behind the actor",
    texture: "weathered architecture, realistic skin, tactile uniform or workwear",
    palette: ["deep olive", "steel blue", "warm tungsten"],
  },
  superhero: {
    want: "turn impossible ability into practical help",
    need: "separate public usefulness from personal worth",
    contradiction: "spectacular power, stubbornly ordinary sense of humor",
    stakes: "a public failure could make protection itself look dangerous",
    vulnerability: "being watched makes private doubt impossible to hide",
    boundary: "never uses power to humiliate an opponent",
    expression: "open confidence with a flicker of calculation before action",
    pressure: "absorbs the impact, plants the feet, then looks first for bystanders",
    gesture: "opens the hand before energy or force gathers",
    movement: "clean arcs, strong landings, human recovery weight after impossible motion",
    hook: "open on a tiny human problem inside a spectacular event",
    escalation: "make greater power create a more personal consequence",
    cliffhanger: "end when the rescue reveals who engineered the emergency",
    payoff: "solve the climax through judgment rather than raw force",
    motifs: ["charged air", "three-note light pulses", "ordinary objects surviving impact"],
    framing: "dynamic medium-wide with clear body silhouette and human-scale foreground",
    angle: "slightly low but close to eye level",
    lens: "40mm cinematic perspective",
    key: "directional cool daylight from frame right",
    fill: "warm city bounce keeping skin natural",
    edge: "controlled energy-colored rim, never a full-body glow",
    texture: "real materials, fine airborne particles, restrained energy effects",
    palette: ["cobalt", "sunlit gold", "graphite"],
  },
  horror: {
    want: "make the living acknowledge what the place remembers",
    need: "release the one memory that keeps the haunting alive",
    contradiction: "terrifying patience, one recognizably human ritual",
    stakes: "every denial allows the environment to repeat the original harm",
    vulnerability: "a familiar melody or object interrupts the menace",
    boundary: "never appears in full light until the truth is spoken",
    expression: "almost neutral, with attention fixed slightly past the other person",
    pressure: "does not accelerate; the environment moves instead",
    gesture: "repeats one small unfinished action from the past",
    movement: "minimal displacement, delayed head turns, appears closer after occlusion",
    hook: "open on an ordinary background detail behaving one beat late",
    escalation: "let the space respond before the figure does",
    cliffhanger: "end with proof the haunting belongs to the viewer's side of the frame",
    payoff: "repeat the opening image with one devastating changed detail",
    motifs: ["empty seats", "stalled mechanisms", "delayed reflections"],
    framing: "locked medium-wide with threatening negative space",
    angle: "waist-height camera held perfectly level",
    lens: "45mm with deep background legibility",
    key: "single weak practical from frame right creating a steep falloff",
    fill: "near-zero fill with only enough level to retain facial structure",
    edge: "cold intermittent edge from a failing source behind frame left",
    texture: "damp walls, dust, damaged emulsion, restrained grain",
    palette: ["mildewed green", "dead amber", "ink black"],
  },
  rebel: {
    want: "expose the bargain everyone agreed not to mention",
    need: "build something after becoming excellent at refusal",
    contradiction: "provocative surface, disciplined strategy underneath",
    stakes: "winning attention without changing the system turns rebellion into branding",
    vulnerability: "loyalty to one person can compromise the clean argument",
    boundary: "never demands a risk they will not take first",
    expression: "direct challenge softened by quick private concern",
    pressure: "moves closer, lowers the voice, and makes the choice concrete",
    gesture: "tears, marks, or repurposes a symbol of authority",
    movement: "diagonal paths, purposeful pace, uses obstacles as staging",
    hook: "open on a familiar rule being broken for an unexpected humane reason",
    escalation: "turn public defiance into a private cost",
    cliffhanger: "end when the movement adopts the tactic they opposed",
    payoff: "replace the rejected system with a visible working alternative",
    motifs: ["torn paper", "hand-painted marks", "crossed sightlines"],
    framing: "handheld-feeling medium shot with assertive diagonals",
    angle: "shoulder-height camera slightly canted only during disruption",
    lens: "32mm close environmental perspective",
    key: "hard lateral daylight or sodium practical from frame left",
    fill: "natural location bounce",
    edge: "brief red or amber edge from moving background light",
    texture: "concrete, paper, paint, real sweat and fabric wear",
    palette: ["rust red", "concrete grey", "electric blue"],
  },
  sidekick: {
    want: "be trusted with more than repairing someone else's legend",
    need: "claim authorship without abandoning loyalty",
    contradiction: "supportive instincts, quietly competitive intelligence",
    stakes: "remaining invisible keeps the team safe but erases the contribution",
    vulnerability: "praise from the lead lands harder than criticism",
    boundary: "never withholds vital information to earn credit",
    expression: "active listening with ideas visible before speech",
    pressure: "hands become precise while speech becomes candid",
    gesture: "checks one tool or note, then hands it over handle-first",
    movement: "works around the lead's axis, then steps into center when needed",
    hook: "open on the sidekick solving the problem just outside the hero's frame",
    escalation: "make competence create a conflict over ownership",
    cliffhanger: "end when the lead asks them to make the call",
    payoff: "the team succeeds only after roles visibly change",
    motifs: ["shared tools", "unfinished diagrams", "hand-offs"],
    framing: "medium two-shot language that can resolve into a clean single",
    angle: "eye level with balanced headroom",
    lens: "45mm natural perspective",
    key: "soft practical key from the work surface",
    fill: "open neutral fill for fast expression changes",
    edge: "cool technical edge from background equipment",
    texture: "workbench detail, layered clothing, functional wear",
    palette: ["copper", "navy", "cream"],
  },
  outsider: {
    want: "belong without becoming harmless",
    need: "let one person interpret the silence correctly",
    contradiction: "self-contained presence, startlingly direct observations",
    stakes: "acceptance may require erasing the difference that makes them useful",
    vulnerability: "an unprompted welcome defeats their prepared distance",
    boundary: "never pretends to misunderstand in order to manipulate",
    expression: "watchful stillness with brief unguarded curiosity",
    pressure: "tracks the room first, then states the forbidden obvious fact",
    gesture: "keeps one hand near a personal object tied to home",
    movement: "holds frame edges, crosses only after mapping the space",
    hook: "open on them noticing a rule nobody else can see",
    escalation: "make each attempt to belong reveal a deeper exclusion",
    cliffhanger: "end when their difference becomes the only route forward",
    payoff: "belonging arrives without requiring assimilation",
    motifs: ["maps", "unfamiliar thresholds", "distant transport"],
    framing: "medium-long frame with layered foreground separation",
    angle: "eye level from just beyond a threshold",
    lens: "55mm compressed environment",
    key: "cool window key from frame left",
    fill: "warm reflected practical from below frame right",
    edge: "soft neutral edge defining the silhouette",
    texture: "transit spaces, worn luggage, rain-softened surfaces",
    palette: ["slate", "distant amber", "faded teal"],
  },
};

const LOCAL_FACE_BLUEPRINTS = [
  {
    age: "late 30s, with fine forehead lines and lived-in eye texture",
    anchors: ["broad straight brows with the left sitting slightly higher", "deep-set almond eyes with a faint crease beneath the right eye", "long straight nose, compact mouth, and a squared jaw softened by one cheek dimple"],
    hair: "dense collar-length wavy dark hair, off-center part, one loose section at the right temple, natural matte finish",
  },
  {
    age: "early 40s, with visible smile lines and an unretouched working face",
    anchors: ["low arched brows with generous spacing above alert round eyes", "slightly hooked nose with a narrow bridge", "full lower lip, tapered chin, and a small mole high on the left cheek"],
    hair: "short coarse dark hair, high left part, lightly receded temples, closely controlled sides without a glossy finish",
  },
  {
    age: "early 30s, with clear adult bone structure and natural under-eye detail",
    anchors: ["strong horizontal brow line broken by a small notch over the right eye", "wide-set hooded eyes with a steady asymmetrical gaze", "rounded nose tip, defined cupid's bow, and a narrow angular jaw"],
    hair: "thick chin-length textured hair, center-left part, tucked behind one ear, soft flyaways retained",
  },
  {
    age: "late 40s, with sun texture at the temples and no cosmetic smoothing",
    anchors: ["dense gently curved brows framing close-set observant eyes", "broad nose with a subtle leftward asymmetry", "thin upper lip, pronounced nasolabial lines, and a strong rounded chin"],
    hair: "short salt-and-pepper waves, natural hairline, brushed back by hand rather than styled into place",
  },
  {
    age: "mid 20s, unmistakably adult, with natural pores and faint expression lines",
    anchors: ["fine straight brows above large deep-set eyes", "compact nose with a softly squared bridge", "wide expressive mouth with one corner resting higher and a softly pointed chin"],
    hair: "dense shoulder-length curls, irregular side part, controlled volume with individual strands visible against the light",
  },
  {
    age: "mid 50s, with a weathered forehead, textured cheeks, and calm age-specific eyes",
    anchors: ["heavy brows with a clean gap over narrow-set eyes", "prominent straight nose with a broad base", "compressed mouth, high cheekbones, and a shallow scar beside the right jaw"],
    hair: "close-cropped salt-and-pepper hair, receded but precise hairline, natural crown texture",
  },
] as const;

function localFaceBlueprint(name: string) {
  let hash = 0;
  for (const character of name) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return LOCAL_FACE_BLUEPRINTS[hash % LOCAL_FACE_BLUEPRINTS.length];
}

function sentence(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  return cleaned ? `${cleaned}.` : "";
}

function compact(value: string, max = 420) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

export function buildProductionBible(input: CharacterIdentityInput): CharacterProductionBible {
  if (input.productionBible) return input.productionBible;
  const d = DIRECTIONS[input.archetype] ?? DIRECTIONS.hero;
  const appearance = input.appearanceBrief?.trim();
  const world = input.worldBrief?.trim();
  const localFace = localFaceBlueprint(input.name);
  return {
    version: 1,
    dramatic: {
      externalWant: d.want,
      innerNeed: d.need,
      contradiction: d.contradiction,
      stakes: d.stakes,
      vulnerability: d.vulnerability,
      moralBoundary: d.boundary,
    },
    performance: {
      restingExpression: d.expression,
      underPressure: d.pressure,
      signatureGesture: d.gesture,
      movementStyle: d.movement,
      eyeline: "looks at the other person while listening; meets lens only for a deliberate direct-address beat",
      tempo: input.archetype === "comic-relief" ? "quick setup, precise pause, clean landing" : "measured start, compressed decision, decisive finish",
    },
    visual: {
      perceivedAge: appearance || localFace.age,
      faceAnchors: appearance
        ? [`follow this exact visible appearance brief: ${appearance}`, ...localFace.anchors.slice(0, 2)]
        : [...localFace.anchors],
      hair: appearance
        ? `derive one exact cut, hairline, part, texture, length, and finish from this direction and never restyle it: ${appearance}`
        : localFace.hair,
      wardrobe: appearance
        ? "preserve the wardrobe, materials, accessories, and wear specified in the appearance direction as one repeatable hero look"
        : `functional ${input.archetype.replace("-", " ")} wardrobe with one repeatable hero garment and no logos`,
      silhouette: d.movement,
      palette: d.palette,
      continuityRules: [
        "same face geometry, perceived age, skin tone, hairline, and body proportions",
        "same hero garment, materials, accessories, and wear pattern unless the story explicitly changes them",
        "real skin pores, fabric weight, hand anatomy, and grounded contact with the set",
      ],
    },
    cinematography: {
      heroFraming: d.framing,
      cameraHeight: d.angle,
      lens: d.lens,
      keyLight: d.key,
      fillLight: d.fill,
      edgeLight: d.edge,
      worldTexture: world || d.texture,
    },
    story: {
      hookPattern: d.hook,
      escalationPattern: d.escalation,
      cliffhangerPattern: d.cliffhanger,
      payoffPattern: d.payoff,
      recurringMotifs: d.motifs,
      avoid: [
        "biography spoken as dialogue",
        "generic hero poses or empty walking shots",
        "explaining an emotion already visible on the face",
        "a cliffhanger that only withholds information without changing the situation",
      ],
    },
  };
}

export function composeVoiceDesignPrompt(character: CharacterIdentityInput) {
  const bible = buildProductionBible(character);
  const persona = `${character.archetype.replace("-", " ")}, ${bible.dramatic.contradiction}`;
  return [
    `Native Indian English with natural Hindi and Urdu pronunciation. ${character.voiceGender}, adult. Studio quality.`,
    `Persona: ${persona}. Emotion: controlled, alert, emotionally specific.`,
    `${sentence(character.voiceDesc || "Clear mid-register resonance")}`,
    `Conversational delivery with ${bible.performance.tempo}; under pressure, ${bible.performance.underPressure}. Clean close-mic signal without reverb, echo, telephone, tape, or synthetic FX.`
  ].join(" ");
}

export function composeSfxPrompt(character: CharacterIdentityInput, sceneTexture?: string) {
  const source = character.sfxDesc || "one tactile signature action";
  return `A 1-2 second non-musical signature sound for ${character.name}: ${source}. ${sceneTexture ? `Let the material character subtly reflect ${sceneTexture}.` : "One immediate physical attack, one distinctive material detail, then a clean stop."} Dry close foreground, realistic texture, instantly recognizable at low volume. No sequence, ambience bed, speech, voice, melody, riser, or trailer braam.`;
}

export function composeThemePrompt(character: CharacterIdentityInput, dramaticBeat?: string) {
  const bible = buildProductionBible(character);
  return `Twelve-second instrumental-only character ident. ${character.themeDesc || "A compact original cinematic motif"}. 92 BPM, D minor. 0-3s: state one three-note motif. 3-8s: develop it with restrained percussion and one contrasting instrument. 8-12s: ${dramaticBeat || bible.story.payoffPattern}, then land on a clean unresolved final accent suitable for a cut. Front-clear motif, controlled low end, no vocals, no choir, no lyrics, no imitation of an existing composition.`;
}

export function composeImagePrompt(character: CharacterIdentityInput, shot: ShotBlueprint) {
  const bible = buildProductionBible(character);
  return [
    "CINEMATIC PRODUCTION STILL — 16:9.",
    `SUBJECT AND IDENTITY: ${character.name}, one original fictional actor. ${bible.visual.perceivedAge}. Preserve these recognition anchors exactly: ${bible.visual.faceAnchors.join("; ")}. Hair: ${bible.visual.hair}. Wardrobe: ${bible.visual.wardrobe}. Silhouette: ${bible.visual.silhouette}.`,
    `PERFORMANCE LOGIC: Their personality is ${compact(character.personality)} The visible contradiction is ${bible.dramatic.contradiction}. At rest: ${bible.performance.restingExpression}. Under pressure: ${bible.performance.underPressure}. Use the signature behavior—${bible.performance.signatureGesture}—instead of a generic pose.`,
    `DRAMATIC MOMENT: ${shot.dramaticBeat}. Start pose: ${shot.subjectStart}. Facial beat: ${shot.facialBeat}. The decision must be readable through the eyes, mouth tension, hands, weight distribution, and eyeline in this single frozen frame.`,
    `SET: ${shot.setting}. World texture: ${bible.cinematography.worldTexture}. Palette: ${bible.visual.palette.join(", ")}.`,
    `CAMERA: ${shot.framing}; ${shot.cameraAngle}; ${shot.lens}. Composition preserves a clean direction of movement and useful negative space.`,
    `LIGHTING: key ${shot.keyLight}; fill/edge ${shot.fillAndEdge}. Keep light direction physically motivated and readable on the face.`,
    `CONTINUITY: ${bible.visual.continuityRules.join("; ")}. Photoreal skin and fabric, correct hands, grounded feet, restrained film grain. No typography, captions, logo, UI, poster layout, watermark, duplicate person, beauty-filter skin, or costume redesign.`
  ].join("\n");
}

/** The definitive casting image: personality first, before any plot-specific scene. */
export function composeIdentityImagePrompt(character: CharacterIdentityInput) {
  const bible = buildProductionBible(character);
  const motif = bible.story.recurringMotifs[0] ?? "one tactile object tied to the actor's world";
  const identityWorld = character.brollScene?.trim() || bible.cinematography.worldTexture;
  return [
    "IDENTITY HERO IMAGE — cinematic live-action casting still, 16:9, one person only. This is the definitive visual identity used to recognize and cast the actor, not a poster and not a plot summary.",
    `ACTOR: ${character.name}, an original fictional ${character.archetype.replace("-", " ")}. ${bible.visual.perceivedAge}. The face must feel singular, lived-in, and repeatable rather than generically attractive. Lock these recognition anchors: ${bible.visual.faceAnchors.join("; ")}. Hair: ${bible.visual.hair}. Natural skin texture, facial asymmetry, believable hands and body proportions.`,
    `VISIBLE PERSONALITY: Translate this personality into behavior, not symbols or text: ${compact(character.personality)} The central contradiction is ${bible.dramatic.contradiction}. Show ${bible.performance.restingExpression}; let a trace of ${bible.dramatic.vulnerability} remain visible beneath it. The actor performs ${bible.performance.signatureGesture} with grounded ${bible.performance.movementStyle}. No smile or heroic pose unless those behaviors specifically require it.`,
    `SIGNATURE LOOK: ${bible.visual.wardrobe}. Build the silhouette around ${bible.visual.silhouette}. Materials must show weight, stitching, wear, and practical function. Palette: ${bible.visual.palette.join(", ")}. Include only one restrained story-world detail—${motif}—as evidence of a life, never as costume decoration.`,
    `WORLD: Place the actor in ${identityWorld}. Choose one uncluttered, believable area of that world that tells us what pressure they live under while keeping the face dominant. Separate foreground, actor, and background into readable depth; no crowd and no unrelated spectacle.`,
    `CAMERA AND COMPOSITION: ${bible.cinematography.heroFraming}; ${bible.cinematography.cameraHeight}; ${bible.cinematography.lens}. Eyes remain the visual priority. Keep enough environmental context to cast the actor, with intentional negative space on the side implied by the eyeline. The image should feel like the first frame before a consequential choice, not a fashion shoot.`,
    `LIGHTING: Motivated key—${bible.cinematography.keyLight}. Fill—${bible.cinematography.fillLight}. Edge—${bible.cinematography.edgeLight}. Preserve readable eye detail and natural skin tone; practical sources in the set must explain every highlight and shadow. Cinematic contrast, restrained grain, no artificial full-body glow.`,
    `LOCKS AND EXCLUSIONS: ${bible.visual.continuityRules.join("; ")}. No second person, duplicate face, celebrity likeness, generic superhero stance, glamour pose, beauty-filter skin, excessive VFX, floating objects, distorted hands, extra fingers, costume redesign, text, title, caption, logo, UI, border, poster layout, or watermark.`
  ].join("\n");
}

export function composeVideoPrompt(_character: CharacterIdentityInput, shot: ShotBlueprint) {
  return [
    "IMAGE-TO-VIDEO — 5 SECONDS. The supplied image is the exact first frame and the only source of truth for face, body, wardrobe, set, composition, color, and lighting. Do not redescribe or redesign them.",
    `INTENT: ${shot.dramaticBeat}.`,
    `0.0-1.2s — ${shot.actionTimeline[0]}`,
    `1.2-3.5s — ${shot.actionTimeline[1]} Facial beat: ${shot.facialBeat}.`,
    `3.5-5.0s — ${shot.actionTimeline[2]} End on ${shot.finalFrame}.`,
    `CAMERA PATH: ${shot.cameraMovement}; preserve the source-image axis, camera height, lens character, and horizon. No cut, no angle jump, no orbit unless stated.`,
    `LIGHT CONTINUITY: keep the source key direction and shadow pattern fixed; only animate motivated practical flicker or environmental changes.`,
    `SECONDARY MOTION: ${shot.environmentalMotion}. Natural blink, breath, cloth inertia, hair response, and grounded body weight; subtle motion beats over constant movement.`,
    "LOCKS: exact identity and facial geometry; stable hands, limbs, wardrobe, background architecture, and object count. No morphing, new props, new people, camera teleport, lip-sync, speech, subtitles, text, logo, or watermark. Silent visual plate; audio is produced separately. --duration 5 --camerafixed false"
  ].join("\n");
}

const SCENE_BLUEPRINTS: Array<Omit<ShotBlueprint, "dialogue"> & { dialogue: (name: string) => string }> = [
  {
    sceneName: "The Interrupted Exit",
    dramaticBeat: "the actor discovers that the safe exit is also the trap and chooses to move toward it anyway",
    hook: "Open on a door unlocking by itself while the actor is still several steps away.",
    setting: "an old projection corridor at night, a metal exit door at frame right, projector spill cutting through suspended dust",
    subjectStart: "three-quarter profile at frame left, weight held on the back foot, one hand near but not touching the latch",
    actionTimeline: [
      "Hold the opening composition; the latch rotates by itself and the actor's eyes move to it before the head follows",
      "the actor transfers weight forward, turns the head toward the doorway, and lets concern resolve into a small deliberate half-smile",
      "one controlled step toward frame right; the hand stops two centimeters from the latch",
    ],
    facialBeat: "recognition, one breath of fear, then chosen resolve without smiling broadly",
    framing: "chest-up three-quarter composition with the door and hand both visible",
    cameraAngle: "eye-level camera just behind the actor's shoulder line",
    lens: "50mm natural perspective",
    cameraMovement: "a single eight-percent dolly-in beginning after the latch moves and easing to a complete stop by 4.6 seconds",
    keyLight: "warm projector spill from rear frame left crossing the cheek",
    fillAndEdge: "cool corridor bounce from frame right, thin warm edge on the far shoulder",
    environmentalMotion: "dust drifts through the projector beam; coat hem responds once to air from the opening door",
    soundTexture: "a close metal mechanism response settles over low projector vibration and short corridor decay",
    musicalArc: "tighten the pulse, interrupt it with one harmonic doubt, then stop on unresolved resolve",
    finalFrame: "the fingertips suspended before the latch and the eyes fixed into the dark gap",
    dialogue: (name) => `${name}: "If that door wanted me gone, it should not have opened."`,
  },
  {
    sceneName: "The False Reflection",
    dramaticBeat: "the actor notices the reflection moving first and decides not to reveal that they saw it",
    hook: "The background reflection completes a turn one beat before the actor.",
    setting: "a rain-dark railway waiting room with a long mirror, wet glass, and one tungsten station lamp",
    subjectStart: "seated in profile in the near foreground, shoulders relaxed, reflection visible over the far shoulder",
    actionTimeline: [
      "The actor remains still while the eyes register a tiny movement in the mirror",
      "the chin lowers by a few degrees and one hand slowly closes around the ticket; the reflection settles back into sync",
      "the actor looks away from the mirror toward the arriving light without exposing the discovery",
    ],
    facialBeat: "private alarm compressed into deliberate calm",
    framing: "medium profile with actor and reflection held in separate thirds",
    cameraAngle: "seated eye level, perfectly level horizon",
    lens: "65mm with compressed layers",
    cameraMovement: "locked frame with only a two-percent optical-feeling creep after 3.5 seconds",
    keyLight: "soft amber station practical from upper frame right",
    fillAndEdge: "cool rain bounce through glass from frame left, no artificial rim",
    environmentalMotion: "rain trails move down the window; distant train light travels across the back wall",
    soundTexture: "rain-muted room tone and a distant rail vibration bloom briefly, then narrow back to the foreground detail",
    musicalArc: "begin intimate, introduce one detuned answer to the motif, and leave the final note suspended",
    finalFrame: "the actor looking toward the train while the reflection appears to look toward camera",
    dialogue: (name) => `${name}: "The last train is never empty. It only looks that way."`,
  },
  {
    sceneName: "Proof in the Hand",
    dramaticBeat: "the actor reveals a tiny piece of evidence that reverses who holds power in the scene",
    hook: "Begin with the apparently empty hand already centered in frame.",
    setting: "a closed museum study under a green-shaded desk lamp, evidence envelopes and dark shelving held in soft depth",
    subjectStart: "standing square to the table, closed hand resting palm-up in the pool of light",
    actionTimeline: [
      "Hold on the closed hand; the thumb shifts and the actor watches the unseen opponent rather than the object",
      "the fingers open once to reveal a small key; the actor raises only the eyes and allows one restrained breath",
      "the hand closes again and exits the pool of light as the actor turns a shoulder toward the door",
    ],
    facialBeat: "quiet confirmation followed by controlled withdrawal",
    framing: "medium close-up including face, hand, and lit tabletop",
    cameraAngle: "slightly above hand level but below the actor's eyes",
    lens: "58mm portrait perspective",
    cameraMovement: "slow lateral slider move of ten centimeters from right to left, stopping when the key is revealed",
    keyLight: "hard-edged warm desk-lamp pool from lower frame left",
    fillAndEdge: "very low cool ambient fill, narrow shelf practical on the hairline",
    environmentalMotion: "one evidence tag shifts in the lamp heat; background remains otherwise still",
    soundTexture: "dry paper movement and close wooden-room reflections reveal one tiny metallic overtone",
    musicalArc: "hold a restrained pulse, reverse the harmony at the reveal, and cut before full resolution",
    finalFrame: "the actor's shoulder crossing the key light, leaving the table empty again",
    dialogue: (name) => `${name}: "You searched the room. You forgot to search the story."`,
  },
  {
    sceneName: "The Cost of the Signal",
    dramaticBeat: "the actor sends a signal that saves someone elsewhere while exposing their own position",
    hook: "A dark rooftop is broken by one deliberate pulse of light.",
    setting: "a monsoon rooftop above the old city, wet parapet, distant windows, a compact signal lamp held below chest level",
    subjectStart: "crouched behind the parapet in three-quarter view, eyes tracking a distant rooftop",
    actionTimeline: [
      "The actor watches the distant roof and takes one controlled breath; rain beads on the lamp glass",
      "the thumb activates one short light pulse and the face catches the reflected glow; the actor immediately reads the consequence off-screen",
      "the lamp is lowered while the actor rises into a ready stance and turns toward the newly revealed threat",
    ],
    facialBeat: "relief at the answering signal interrupted by the recognition of danger",
    framing: "medium-wide silhouette with readable face and city depth",
    cameraAngle: "low parapet height looking slightly upward without heroic exaggeration",
    lens: "40mm environmental perspective",
    cameraMovement: "subtle handheld breathing, then a short controlled push toward the face during the signal pulse",
    keyLight: "cool monsoon sky from frame left with the lamp briefly becoming a warm under-key",
    fillAndEdge: "soft city bounce, wet-surface edge from distant practicals",
    environmentalMotion: "rain moves diagonally left to right; fabric and loose cable respond to one gust after the pulse",
    soundTexture: "wind and rain against concrete widen around a short electrical pulse, then collapse to a dry stop",
    musicalArc: "rise toward a brief luminous motif, expose a darker counter-note, and end on alert tension",
    finalFrame: "the actor upright against the skyline, lamp dark, gaze locked on an off-screen approach",
    dialogue: (name) => `${name}: "They saw the signal. So did everyone else."`,
  },
];

export function buildScenePackage(character: CharacterIdentityInput, index = 0): ScenePackage {
  const shotTemplate = SCENE_BLUEPRINTS[((index % SCENE_BLUEPRINTS.length) + SCENE_BLUEPRINTS.length) % SCENE_BLUEPRINTS.length];
  const shot: ShotBlueprint = {
    ...shotTemplate,
    setting: character.brollScene?.trim() || shotTemplate.setting,
    dialogue: index === 0 && character.brollLine?.trim()
      ? character.brollLine.trim()
      : shotTemplate.dialogue(character.name),
  };
  const dialoguePrefix = `${character.name}: `;
  const dialogue = shot.dialogue.startsWith(dialoguePrefix)
    ? shot.dialogue.slice(dialoguePrefix.length)
    : shot.dialogue;
  return {
    sceneName: shot.sceneName,
    hook: shot.hook,
    dialogue: dialogue.replace(/^"|"$/g, ""),
    image: composeImagePrompt(character, shot),
    video: composeVideoPrompt(character, shot),
    sfx: composeSfxPrompt(character, shot.soundTexture),
    theme: composeThemePrompt(character, shot.musicalArc),
    blueprint: shot,
  };
}
