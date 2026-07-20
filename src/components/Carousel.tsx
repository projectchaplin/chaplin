"use client";

import { useEffect, useRef } from "react";

export default function Carousel({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ isDown: false, startX: 0, startScroll: 0, moved: false });

  function scrollByAmount(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 640);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "touch") return; // native touch scroll already works
      drag.current.isDown = true;
      drag.current.moved = false;
      drag.current.startX = e.clientX;
      drag.current.startScroll = el!.scrollLeft;
    }
    function onPointerMove(e: PointerEvent) {
      if (!drag.current.isDown) return;
      const dx = e.clientX - drag.current.startX;
      if (Math.abs(dx) > 4) drag.current.moved = true;
      el!.scrollLeft = drag.current.startScroll - dx;
    }
    function endDrag() {
      drag.current.isDown = false;
    }
    function onClickCapture(e: MouseEvent) {
      if (drag.current.moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return (
    <div className="relative group/carousel">
      <div
        ref={trackRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar pb-2 -mx-1 px-1 cursor-grab active:cursor-grabbing select-none"
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => scrollByAmount(-1)}
        aria-label="Scroll left"
        className="hidden sm:flex items-center justify-start absolute left-0 top-0 bottom-2 w-14 bg-gradient-to-r from-paper via-paper/80 to-transparent opacity-0 group-hover/carousel:opacity-100 transition-opacity"
      >
        <span className="ml-1 w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center text-base shadow-md hover:bg-accent hover:text-paper transition-colors">
          ‹
        </span>
      </button>
      <button
        type="button"
        onClick={() => scrollByAmount(1)}
        aria-label="Scroll right"
        className="hidden sm:flex items-center justify-end absolute right-0 top-0 bottom-2 w-14 bg-gradient-to-l from-paper via-paper/80 to-transparent opacity-0 group-hover/carousel:opacity-100 transition-opacity"
      >
        <span className="mr-1 w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center text-base shadow-md hover:bg-accent hover:text-paper transition-colors">
          ›
        </span>
      </button>
    </div>
  );
}
