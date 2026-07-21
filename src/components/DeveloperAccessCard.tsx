"use client";

import { useState } from "react";
import type { Character } from "@/lib/types";
import { IconLock, IconPlug, IconDownload } from "@/components/Icons";

export default function DeveloperAccessCard({ character }: { character: Character }) {
  const [unlocked, setUnlocked] = useState(false);
  const mcpEndpoint = `mcp://chaplin.ai/characters/${character.id}`;

  function downloadConfig() {
    const config = {
      id: character.id,
      name: character.name,
      archetype: character.archetype,
      tagline: character.tagline,
      personality: character.personality,
      voiceDesc: character.voiceDesc,
      voiceId: character.voiceId,
      sfxDesc: character.sfxDesc,
      themeDesc: character.themeDesc,
      licenseType: character.licenseType,
      royaltyRate: character.royaltyRate,
      mcpEndpoint,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${character.id}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="poster-card rounded-md p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-grey mb-3">
        Developer access
      </h2>

      <div className="relative rounded-sm overflow-hidden">
        <div
          className={`flex flex-col gap-3 transition-[filter] ${
            unlocked ? "" : "blur-[3px] pointer-events-none select-none"
          }`}
        >
          <div>
            <p className="text-[11px] text-grey mb-1 flex items-center gap-1">
              <IconPlug className="w-3.5 h-3.5" /> Connect via MCP
            </p>
            <div className="bg-paper-dim rounded-sm px-3 py-2 text-xs font-mono text-ink/80 overflow-x-auto whitespace-nowrap">
              {mcpEndpoint}
            </div>
          </div>

          <button
            onClick={downloadConfig}
            className="inline-flex items-center gap-1.5 text-xs border border-line rounded-full px-3 py-1.5 self-start hover:border-accent hover:text-accent transition-colors"
          >
            <IconDownload className="w-3.5 h-3.5" />
            Download JSON config
          </button>
        </div>

        {!unlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 bg-paper/75">
            <IconLock className="w-5 h-5 text-grey" />
            <p className="text-[11px] text-grey max-w-[220px]">
              Unlock API access and character export tools for {character.name.split(" ")[0]}
            </p>
            <button
              onClick={() => setUnlocked(true)}
              className="accent-btn text-xs font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
            >
              Unlock developer access — $19/mo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
