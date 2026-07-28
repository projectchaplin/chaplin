"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import Avatar from "@/components/Avatar";
import {
  buildCharacterSystem,
  composeCharacterInteractionPrompt,
  composeCharacterSheetPrompt,
} from "@/lib/character-system";
import {
  buildProductionBible,
  composeCharacterMasterPrompt,
} from "@/lib/production-prompting";
import { useChaplinStore } from "@/lib/store";
import type { Character, CharacterAgeStateId, CharacterSheetViewId } from "@/lib/types";

type NodeId = "canon" | "bible" | "sheet" | "output" | "sound" | "memory" | "performance" | "media";
type Point = { x: number; y: number };
type NodePositions = Record<NodeId, Point>;
type Camera = { x: number; y: number; scale: number };

const WORLD = { width: 3600, height: 2400 };
const LAYOUT_BOUNDS = { width: 1780, height: 1140 };
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.6;
const DEFAULT_POSITIONS: NodePositions = {
  canon: { x: 50, y: 310 },
  bible: { x: 370, y: 74 },
  sheet: { x: 705, y: 60 },
  output: { x: 1140, y: 60 },
  sound: { x: 380, y: 610 },
  memory: { x: 715, y: 760 },
  performance: { x: 1115, y: 710 },
  media: { x: 1545, y: 310 },
};

const NODE_SIZES: Record<NodeId, { width: number; height: number }> = {
  canon: { width: 280, height: 345 },
  bible: { width: 300, height: 390 },
  sheet: { width: 400, height: 650 },
  output: { width: 385, height: 620 },
  sound: { width: 300, height: 250 },
  memory: { width: 330, height: 270 },
  performance: { width: 310, height: 270 },
  media: { width: 220, height: 180 },
};

const CONNECTIONS: Array<[NodeId, NodeId]> = [
  ["canon", "bible"],
  ["canon", "sheet"],
  ["bible", "sheet"],
  ["sheet", "output"],
  ["canon", "sound"],
  ["bible", "memory"],
  ["sound", "performance"],
  ["memory", "performance"],
  ["output", "performance"],
  ["output", "media"],
];

function center(position: Point, id: NodeId) {
  const size = NODE_SIZES[id];
  return { x: position.x + size.width / 2, y: position.y + size.height / 2 };
}

function connectionPath(fromId: NodeId, toId: NodeId, positions: NodePositions) {
  const from = center(positions[fromId], fromId);
  const to = center(positions[toId], toId);
  const direction = to.x >= from.x ? 1 : -1;
  const startX = from.x + direction * NODE_SIZES[fromId].width / 2;
  const endX = to.x - direction * NODE_SIZES[toId].width / 2;
  const bend = Math.max(60, Math.abs(endX - startX) * 0.45);
  return `M ${startX} ${from.y} C ${startX + direction * bend} ${from.y}, ${endX - direction * bend} ${to.y}, ${endX} ${to.y}`;
}

function NodeCard({
  id,
  title,
  eyebrow,
  positions,
  onPointerDown,
  children,
  className = "",
}: {
  id: NodeId;
  title: string;
  eyebrow: string;
  positions: NodePositions;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, id: NodeId) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const position = positions[id];
  const size = NODE_SIZES[id];
  return (
    <section
      className={`character-system-node absolute overflow-hidden rounded-[22px] border border-white/10 bg-[#11190d]/95 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl ${className}`}
      style={{ left: position.x, top: position.y, width: size.width, minHeight: size.height }}
      data-node-id={id}
    >
      <div
        className="character-system-node-handle flex cursor-grab touch-none items-start justify-between gap-3 border-b border-white/8 px-4 py-3 active:cursor-grabbing"
        onPointerDown={(event) => onPointerDown(event, id)}
      >
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
          <h2 className="mt-1 text-sm font-semibold text-ink">{title}</h2>
        </div>
        <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 text-[11px] text-grey">••</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TinyStatus({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] ${
      active ? "border-[#07d2be]/45 bg-[#07d2be]/10 text-[#36e0cd]" : "border-white/10 text-grey"
    }`}>
      {children}
    </span>
  );
}

type SheetAsset = { url: string; assetId?: string };
type SheetAssets = Record<string, SheetAsset>;

function sheetSlotKey(viewId: CharacterSheetViewId, ageId: CharacterAgeStateId) {
  return `${viewId}:${ageId}`;
}

async function responseError(response: Response) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return data?.error ?? `Request failed with status ${response.status}.`;
}

export default function CharacterNodeWorkspace({ character }: { character: Character }) {
  const addCharacterImage = useChaplinStore((state) => state.addCharacterImage);
  const mergePersistedCharacters = useChaplinStore((state) => state.mergePersistedCharacters);
  const bible = useMemo(() => buildProductionBible(character), [character]);
  const system = useMemo(
    () => bible.system ?? buildCharacterSystem(character, bible),
    [bible, character],
  );
  const storageKey = `chaplin:character-system-layout:${character.id}`;
  const [positions, setPositions] = useState<NodePositions>(DEFAULT_POSITIONS);
  const [camera, setCamera] = useState<Camera>({ x: 42, y: 36, scale: 0.7 });
  useEffect(() => {
    let savedPositions: NodePositions | null = null;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) savedPositions = { ...DEFAULT_POSITIONS, ...JSON.parse(saved) as Partial<NodePositions> };
    } catch {
      // A corrupt personal layout should never block the character workspace.
    }
    if (!savedPositions) return;
    const frame = window.requestAnimationFrame(() => setPositions(savedPositions));
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);
  const sheetStorageKey = `chaplin:character-sheet-assets:${character.id}`;
  const [viewId, setViewId] = useState<CharacterSheetViewId>(system.sheet.canonicalViewId);
  const [ageId, setAgeId] = useState<CharacterAgeStateId>(system.sheet.canonicalAgeStateId);
  const [expression, setExpression] = useState("");
  const [wardrobe, setWardrobe] = useState("");
  const [sheetAssets, setSheetAssets] = useState<SheetAssets>({});
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetMessage, setSheetMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [masterPromptOpen, setMasterPromptOpen] = useState(false);
  const [masterPromptCopied, setMasterPromptCopied] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: NodeId;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; cameraX: number; cameraY: number } | null>(null);

  useEffect(() => {
    let savedAssets: SheetAssets | null = null;
    try {
      const saved = window.localStorage.getItem(sheetStorageKey);
      if (saved) savedAssets = JSON.parse(saved) as SheetAssets;
    } catch {
      // The generated assets still live in the gallery if this local slot map is unavailable.
    }
    if (!savedAssets) return;
    const frame = window.requestAnimationFrame(() => setSheetAssets(savedAssets));
    return () => window.cancelAnimationFrame(frame);
  }, [sheetStorageKey]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => focusSheet());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function fitLayout() {
    const viewport = viewportRef.current;
    if (!viewport || window.innerWidth < 768) return;
    const rect = viewport.getBoundingClientRect();
    const scale = Math.max(MIN_ZOOM, Math.min(0.92, Math.min((rect.width - 96) / LAYOUT_BOUNDS.width, (rect.height - 96) / LAYOUT_BOUNDS.height)));
    setCamera({
      scale,
      x: Math.max(24, (rect.width - LAYOUT_BOUNDS.width * scale) / 2 - 48),
      y: Math.max(42, (rect.height - LAYOUT_BOUNDS.height * scale) / 2 - 38),
    });
  }

  function focusSheet() {
    const viewport = viewportRef.current;
    if (!viewport || window.innerWidth < 768) return;
    const rect = viewport.getBoundingClientRect();
    const sheetBounds = { x: 680, y: 35, width: 870, height: 730 };
    const scale = Math.max(
      MIN_ZOOM,
      Math.min(0.72, (rect.width - 80) / sheetBounds.width, (rect.height - 72) / sheetBounds.height),
    );
    setCamera({
      scale,
      x: (rect.width - sheetBounds.width * scale) / 2 - sheetBounds.x * scale,
      y: Math.max(26, (rect.height - sheetBounds.height * scale) / 2 - sheetBounds.y * scale),
    });
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, id: NodeId) {
    if (window.innerWidth < 768) return;
    const node = event.currentTarget.closest<HTMLElement>("[data-node-id]");
    const viewport = viewportRef.current;
    if (!node || !viewport) return;
    const rect = node.getBoundingClientRect();
    dragRef.current = {
      id,
      offsetX: (event.clientX - rect.left) / camera.scale,
      offsetY: (event.clientY - rect.top) / camera.scale,
    };
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (window.innerWidth < 768 || (event.target as HTMLElement).closest("[data-node-id]")) return;
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cameraX: camera.x, cameraY: camera.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    if (drag && viewport && window.innerWidth >= 768) {
      const rect = viewport.getBoundingClientRect();
      const nextX = Math.max(10, Math.min(WORLD.width - NODE_SIZES[drag.id].width - 10, (event.clientX - rect.left - camera.x) / camera.scale - drag.offsetX));
      const nextY = Math.max(10, Math.min(WORLD.height - NODE_SIZES[drag.id].height - 10, (event.clientY - rect.top - camera.y) / camera.scale - drag.offsetY));
      setPositions((current) => {
        const next = { ...current, [drag.id]: { x: nextX, y: nextY } };
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      setCamera((current) => ({ ...current, x: pan.cameraX + event.clientX - pan.startX, y: pan.cameraY + event.clientY - pan.startY }));
    }
  }

  function stopPointer() {
    dragRef.current = null;
    panRef.current = null;
  }

  function zoomTo(nextScale: number, clientX?: number, clientY?: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextScale));
    const screenX = clientX ?? rect.left + rect.width / 2;
    const screenY = clientY ?? rect.top + rect.height / 2;
    const worldX = (screenX - rect.left - camera.x) / camera.scale;
    const worldY = (screenY - rect.top - camera.y) / camera.scale;
    setCamera({ scale, x: screenX - rect.left - worldX * scale, y: screenY - rect.top - worldY * scale });
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (window.innerWidth < 768) return;
    event.preventDefault();
    zoomTo(camera.scale * (event.deltaY > 0 ? 0.9 : 1.1), event.clientX, event.clientY);
  }

  const sheetPrompt = useMemo(
    () => composeCharacterSheetPrompt(character, bible, {
      viewId,
      ageStateId: ageId,
      expression,
      wardrobeOverride: wardrobe,
    }),
    [ageId, bible, character, expression, viewId, wardrobe],
  );
  const masterPrompt = useMemo(
    () => [
      composeCharacterMasterPrompt(character),
      "",
      "## Exact runtime conversation system prompt",
      composeCharacterInteractionPrompt(character, bible),
    ].join("\n"),
    [bible, character],
  );
  const mediaCount = (character.galleryUrls?.length ?? 0) + (character.imageUrl ? 1 : 0) + (character.videoUrl ? 1 : 0);
  const canonicalImage = character.imageUrl ?? character.bannerUrl;
  const activeSlotKey = sheetSlotKey(viewId, ageId);
  const activeSheetAsset = sheetAssets[activeSlotKey];

  async function copyPrompt() {
    await navigator.clipboard.writeText(sheetPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copyMasterPrompt() {
    await navigator.clipboard.writeText(masterPrompt);
    setMasterPromptCopied(true);
    window.setTimeout(() => setMasterPromptCopied(false), 1600);
  }

  function resetLayout() {
    setPositions(DEFAULT_POSITIONS);
    window.localStorage.setItem(storageKey, JSON.stringify(DEFAULT_POSITIONS));
    fitLayout();
  }

  function saveSheetAsset(slotKey: string, asset: SheetAsset) {
    setSheetAssets((current) => {
      const next = { ...current, [slotKey]: asset };
      window.localStorage.setItem(sheetStorageKey, JSON.stringify(next));
      return next;
    });
  }

  async function ensureCharacterIsSaved() {
    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character, ensureOnly: true }),
    });
    if (!response.ok) throw new Error(await responseError(response));
  }

  async function generateSheetImage() {
    setSheetBusy(true);
    setSheetMessage("");
    try {
      await ensureCharacterIsSaved();
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "image",
          characterId: character.id,
          character,
          imagePurpose: "identity",
          prompt: sheetPrompt,
          referenceImage: canonicalImage ?? "",
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json() as { url?: string; assetId?: string };
      if (!data.url) throw new Error("The image provider did not return a reference frame.");
      saveSheetAsset(activeSlotKey, { url: data.url, assetId: data.assetId });
      addCharacterImage(character.id, data.url);
      window.dispatchEvent(new CustomEvent("chaplin:media-updated", { detail: { characterId: character.id } }));
      setSheetMessage(`Generated ${system.sheet.views.find((view) => view.id === viewId)?.label.toLowerCase()} · ${system.sheet.ageStates.find((age) => age.id === ageId)?.label.toLowerCase()}. Review it before promoting it.`);
    } catch (error) {
      setSheetMessage(error instanceof Error ? error.message : "The reference frame could not be generated.");
    } finally {
      setSheetBusy(false);
    }
  }

  async function promoteSheetImage() {
    if (!activeSheetAsset?.assetId) return;
    setSheetBusy(true);
    setSheetMessage("");
    try {
      const response = await fetch("/api/characters/profile-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, assetId: activeSheetAsset.assetId, slot: "cover" }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const catalogueResponse = await fetch("/api/characters", { cache: "no-store" });
      if (catalogueResponse.ok) {
        const catalogue = await catalogueResponse.json() as { characters?: Character[] };
        if (Array.isArray(catalogue.characters)) mergePersistedCharacters(catalogue.characters);
      }
      window.dispatchEvent(new CustomEvent("chaplin:media-updated", { detail: { characterId: character.id } }));
      setSheetMessage("Promoted to canonical reference. New stills and motion will now use this approved frame.");
    } catch (error) {
      setSheetMessage(error instanceof Error ? error.message : "The reference frame could not be promoted.");
    } finally {
      setSheetBusy(false);
    }
  }

  return (
    <div className="character-system-workspace min-h-[calc(100dvh-5rem)] bg-[#080d05] text-ink">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080d05]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/characters/${character.id}`} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-semibold text-grey hover:text-ink">
              ← Profile
            </Link>
            <Avatar hue={character.avatarHue} label={character.name} src={canonicalImage} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{character.name}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#36e0cd]">Character system</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TinyStatus active>Canon connected</TinyStatus>
            <button
              type="button"
              onClick={() => setMasterPromptOpen(true)}
              className="rounded-full border border-accent/45 bg-accent/10 px-3 py-2 text-[9px] font-semibold text-accent hover:bg-accent/15"
            >
              View master prompt
            </button>
            <div className="hidden items-center rounded-full border border-white/10 bg-black/20 sm:flex">
              <button type="button" onClick={() => zoomTo(camera.scale / 1.18)} className="px-2.5 py-2 text-sm text-grey hover:text-ink" aria-label="Zoom out">−</button>
              <button type="button" onClick={fitLayout} className="min-w-12 border-x border-white/10 px-2 py-2 text-[9px] font-semibold text-grey hover:text-ink" aria-label="Fit all notes">{Math.round(camera.scale * 100)}%</button>
              <button type="button" onClick={() => zoomTo(camera.scale * 1.18)} className="px-2.5 py-2 text-sm text-grey hover:text-ink" aria-label="Zoom in">+</button>
            </div>
            <button
              type="button"
              onClick={focusSheet}
              className="hidden rounded-full border border-white/10 px-3 py-2 text-[9px] font-semibold text-grey hover:text-ink sm:block"
            >
              Focus sheet
            </button>
            <button
              type="button"
              onClick={resetLayout}
              className="hidden rounded-full border border-white/10 px-3 py-2 text-[9px] font-semibold text-grey hover:text-ink lg:block"
            >
              Reset layout
            </button>
          </div>
        </div>
      </header>

      {masterPromptOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="master-prompt-title">
          <section className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0b1208] shadow-2xl">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-accent">Super Admin only</p>
                <h2 id="master-prompt-title" className="mt-1 text-lg font-semibold">{character.name} · master character prompt</h2>
                <p className="mt-1 text-[10px] text-grey">Complete Magic Write canon, production bible, CharacterCardV2, derived audio direction, and runtime conversation prompt. Makers, brands, and casters are redirected before this page renders.</p>
              </div>
              <button type="button" onClick={() => setMasterPromptOpen(false)} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-semibold text-grey hover:text-ink">
                Close
              </button>
            </header>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-5 font-sans text-xs leading-6 text-ink">{masterPrompt}</pre>
            <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
              <span className="text-[9px] uppercase tracking-[0.14em] text-grey">Private system material</span>
              <button type="button" onClick={() => void copyMasterPrompt()} className="rounded-full bg-accent px-4 py-2 text-[10px] font-bold text-[#090b08]">
                {masterPromptCopied ? "Copied to clipboard ✓" : "Copy complete master prompt"}
              </button>
            </footer>
          </section>
        </div>
      )}

      <div
        ref={viewportRef}
        className="character-system-viewport relative h-[calc(100dvh-8.2rem)] min-h-[560px] overflow-hidden touch-none"
        onPointerDown={beginPan}
        onPointerMove={movePointer}
        onPointerUp={stopPointer}
        onPointerCancel={stopPointer}
        onWheel={handleWheel}
      >
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-[#080d05]/75 px-3 py-2 text-[9px] text-grey backdrop-blur-md sm:left-6 sm:top-6">
          Drag the background to move · scroll to zoom · drag a note by its header
        </div>
        <div
          className="character-system-world relative"
          style={{ width: WORLD.width, height: WORLD.height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}
        >
          <svg className="character-system-connections pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="character-system-line" x1="0" x2="1">
                <stop offset="0" stopColor="#f24e70" stopOpacity=".65" />
                <stop offset="1" stopColor="#07d2be" stopOpacity=".7" />
              </linearGradient>
            </defs>
            {CONNECTIONS.map(([from, to]) => (
              <g key={`${from}-${to}`}>
                <path d={connectionPath(from, to, positions)} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" />
                <path d={connectionPath(from, to, positions)} fill="none" stroke="url(#character-system-line)" strokeWidth="1.5" />
              </g>
            ))}
          </svg>

          <NodeCard id="canon" title={character.name} eyebrow="Canonical actor" positions={positions} onPointerDown={beginDrag}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/25">
              {canonicalImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={canonicalImage} alt={character.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center"><Avatar hue={character.avatarHue} label={character.name} size={88} /></div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                <p className="text-xs font-semibold">{character.tagline}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <TinyStatus active>Identity seed</TinyStatus>
              <TinyStatus>{character.archetype}</TinyStatus>
              <TinyStatus>{bible.visual.medium || "live action"}</TinyStatus>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-grey">
              The face, proportions, hair, and signature details in this image govern every downstream frame.
            </p>
          </NodeCard>

          <NodeCard id="bible" title="Actor direction bible" eyebrow="Dramatic engine" positions={positions} onPointerDown={beginDrag}>
            <div className="space-y-3 text-[10px] leading-4">
              <div><p className="font-bold uppercase tracking-wider text-accent">Wants</p><p className="mt-1 text-grey">{bible.dramatic.externalWant}</p></div>
              <div><p className="font-bold uppercase tracking-wider text-[#36e0cd]">Needs</p><p className="mt-1 text-grey">{bible.dramatic.innerNeed}</p></div>
              <div><p className="font-bold uppercase tracking-wider text-[#f7d94c]">Contradiction</p><p className="mt-1 text-grey">{bible.dramatic.contradiction}</p></div>
              <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                <p className="font-semibold text-ink">Recognition locks</p>
                <ol className="mt-2 space-y-1 text-grey">
                  {(bible.visual.recognitionLocks ?? bible.visual.continuityRules).slice(0, 4).map((lock, index) => (
                    <li key={lock}>{index + 1}. {lock}</li>
                  ))}
                </ol>
              </div>
            </div>
          </NodeCard>

          <NodeCard id="sheet" title="Reference sheet generator" eyebrow="Visual continuity" positions={positions} onPointerDown={beginDrag}>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-grey">
                View
                <select value={viewId} onChange={(event) => setViewId(event.target.value as CharacterSheetViewId)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080d05] px-2 py-2 text-[10px] normal-case tracking-normal text-ink">
                  {system.sheet.views.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-bold uppercase tracking-wider text-grey">
                Age
                <select value={ageId} onChange={(event) => setAgeId(event.target.value as CharacterAgeStateId)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080d05] px-2 py-2 text-[10px] normal-case tracking-normal text-ink">
                  {system.sheet.ageStates.map((age) => <option key={age.id} value={age.id}>{age.label}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-[9px] font-bold uppercase tracking-wider text-grey">
              Expression <span className="normal-case font-normal tracking-normal text-grey/70">(optional override)</span>
              <input value={expression} onChange={(event) => setExpression(event.target.value)} placeholder={bible.performance.restingExpression} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080d05] px-2 py-2 text-[10px] font-normal normal-case tracking-normal text-ink placeholder:text-grey/55" />
            </label>
            <label className="mt-2 block text-[9px] font-bold uppercase tracking-wider text-grey">
              Wardrobe <span className="normal-case font-normal tracking-normal text-grey/70">(optional override)</span>
              <input value={wardrobe} onChange={(event) => setWardrobe(event.target.value)} placeholder={bible.visual.wardrobe} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080d05] px-2 py-2 text-[10px] font-normal normal-case tracking-normal text-ink placeholder:text-grey/55" />
            </label>
            <details className="mt-3 rounded-xl border border-white/8 bg-black/25">
              <summary className="cursor-pointer px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-grey">Provider prompt</summary>
              <pre className="character-system-prompt max-h-40 overflow-auto whitespace-pre-wrap border-t border-white/8 p-3 font-sans text-[9px] leading-4 text-grey">
                {sheetPrompt}
              </pre>
            </details>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={copyPrompt} className="flex-1 rounded-full bg-accent px-3 py-2 text-[10px] font-bold text-[#090b08]">
                {copied ? "Copied" : "Copy provider prompt"}
              </button>
              <button type="button" onClick={() => void generateSheetImage()} disabled={sheetBusy} className="magic-action rounded-full px-3 py-2 text-[10px] font-bold disabled:opacity-50" data-intelligence-action aria-busy={sheetBusy}>
                {sheetBusy ? "Creating…" : "Create image"}
              </button>
            </div>
            <p className="mt-3 text-[9px] leading-4 text-grey">Each frame is generated from the locked canonical image, then stays a draft until you promote it.</p>
            {sheetMessage && <p aria-live="polite" className="mt-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[9px] leading-4 text-grey">{sheetMessage}</p>}
          </NodeCard>

          <NodeCard id="output" title="Character sheet" eyebrow="8 views × 3 ages" positions={positions} onPointerDown={beginDrag}>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/20 p-2.5">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#36e0cd]">Canonical source</p>
                <p className="mt-1 text-[9px] leading-4 text-grey">Every draft starts from this approved identity.</p>
              </div>
              {canonicalImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={canonicalImage} alt={`${character.name} canonical reference`} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-white/15 text-[8px] text-grey">None</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {system.sheet.views.map((view) => {
                const asset = sheetAssets[sheetSlotKey(view.id, ageId)];
                return (
                  <button key={view.id} type="button" onClick={() => setViewId(view.id)} className={`relative aspect-square overflow-hidden rounded-lg border text-left ${viewId === view.id ? "border-accent shadow-[0_0_0_1px_rgba(242,78,112,.25)]" : "border-white/8"}`}>
                    {asset ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.url} alt={`${view.label} reference`} className="h-full w-full object-cover" />
                    ) : <span className="grid h-full place-items-center text-lg text-grey/60">+</span>}
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 text-[7px] font-bold uppercase">{view.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {system.sheet.ageStates.map((age) => (
                <button key={age.id} type="button" onClick={() => setAgeId(age.id)} className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase ${ageId === age.id ? "border-[#07d2be] text-[#36e0cd]" : "border-white/10 text-grey"}`}>
                  {age.label}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold">Selected frame</p><TinyStatus active={Boolean(activeSheetAsset)}>{activeSheetAsset ? "Draft ready" : "Empty slot"}</TinyStatus></div>
              <p className="mt-1 text-[9px] leading-4 text-grey">{system.sheet.views.find((view) => view.id === viewId)?.label} · {system.sheet.ageStates.find((age) => age.id === ageId)?.label}</p>
              {activeSheetAsset ? (
                <button type="button" onClick={() => void promoteSheetImage()} disabled={sheetBusy || !activeSheetAsset.assetId} className="mt-3 w-full rounded-full border border-[#f7d94c]/45 bg-[#f7d94c]/10 px-3 py-2 text-[9px] font-bold text-[#f7d94c] disabled:opacity-45">
                  Promote as canonical reference
                </button>
              ) : <p className="mt-3 text-[9px] leading-4 text-grey">Choose a view, set the age, and create a frame. Empty slots deliberately do not borrow unrelated gallery stills.</p>}
            </div>
          </NodeCard>

          <NodeCard id="sound" title="Voice & sound identity" eyebrow="Locked performance" positions={positions} onPointerDown={beginDrag}>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/8 p-3">
                <div className="flex items-center justify-between"><p className="text-[10px] font-semibold">Voice</p><TinyStatus active={Boolean(character.voiceId)}>{character.voiceId ? "Locked" : "Draft"}</TinyStatus></div>
                <p className="mt-2 line-clamp-3 text-[9px] leading-4 text-grey">{character.voiceDesc}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/8 p-3"><p className="text-[9px] font-semibold">SFX</p><p className="mt-1 line-clamp-2 text-[8px] text-grey">{character.sfxDesc}</p></div>
                <div className="rounded-xl border border-white/8 p-3"><p className="text-[9px] font-semibold">Theme</p><p className="mt-1 line-clamp-2 text-[8px] text-grey">{character.themeDesc}</p></div>
              </div>
            </div>
          </NodeCard>

          <NodeCard id="memory" title="Memory & interaction" eyebrow="Living character" positions={positions} onPointerDown={beginDrag}>
            <p className="text-[10px] leading-4 text-grey">{system.interaction.firstPersonSelfConcept}</p>
            <div className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#36e0cd]">Writable memory</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {system.memory.writableMemoryTypes.map((type) => <TinyStatus key={type}>{type}</TinyStatus>)}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[9px] text-grey">
              <span>Recent recall {system.memory.retrieveRecent}</span>
              <span>Salient recall {system.memory.retrieveSalient}</span>
            </div>
            <p className="mt-3 text-[9px] leading-4 text-grey">Creator-private instructions, identity locks, and unverified relationships cannot be written into memory.</p>
          </NodeCard>

          <NodeCard id="performance" title="Scene performance" eyebrow="Production output" positions={positions} onPointerDown={beginDrag}>
            <p className="text-[10px] leading-4 text-grey">
              The scene pipeline reads identity, pressure behavior, locked voice, canonical reference, and retrieved memory before generating a shot.
            </p>
            <div className="mt-3 space-y-2">
              {["Still frame", "Silent motion", "Voice + sound", "Approval"].map((step, index) => (
                <div key={step} className="flex items-center gap-2 text-[9px]">
                  <span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-[#07d2be]" : "bg-white/15"}`} />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <Link href={`/characters/${character.id}#production-studio`} className="mt-4 block rounded-full bg-accent px-4 py-2.5 text-center text-[10px] font-bold text-[#090b08]">
              Open production studio →
            </Link>
          </NodeCard>

          <NodeCard id="media" title="Media library" eyebrow="Reusable assets" positions={positions} onPointerDown={beginDrag}>
            <p className="font-serif text-3xl">{mediaCount}</p>
            <p className="mt-1 text-[9px] uppercase tracking-wider text-grey">connected assets</p>
            <div className="mt-4 flex flex-wrap gap-1"><TinyStatus>Cover</TinyStatus><TinyStatus>Stills</TinyStatus><TinyStatus>Video</TinyStatus></div>
            <Link href={`/characters/${character.id}`} className="mt-4 block text-[9px] font-semibold text-accent">Review on profile →</Link>
          </NodeCard>
        </div>
      </div>
    </div>
  );
}
