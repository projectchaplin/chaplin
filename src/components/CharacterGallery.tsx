"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

export default function CharacterGallery({
  name,
  images,
}: {
  name: string;
  images: string[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="poster-card rounded-md p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-grey mb-3">
        Gallery
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {[...new Set(images)].map((src, i) => (
          <button
            key={src}
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square rounded-sm overflow-hidden group"
          >
            <Image
              src={src}
              alt={`${name} — gallery photo ${i + 1}`}
              fill
              sizes="120px"
              className="object-cover transition-transform duration-300 group-hover:scale-110"
            />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {openIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpenIndex(null)}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md aspect-square rounded-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={images[openIndex]}
                alt={`${name} — gallery photo ${openIndex + 1}`}
                fill
                sizes="480px"
                className="object-cover"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
