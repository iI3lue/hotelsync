"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Photo from "./Photo";

/**
 * Imagen de fondo a sangre con parallax suave (se desplaza más lento que
 * la página) y una entrada lenta tipo "ken burns" al cargar.
 */
export default function ParallaxImage({
  src,
  alt,
  strength = 120,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  strength?: number;
  className?: string;
  priority?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [0, mounted && !reduce ? strength : 0]
  );

  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden ${className}`}>
      <motion.div style={{ y }} className="absolute inset-x-0 -top-[6%] h-[112%] will-change-transform">
        <div className="h-full w-full animate-ken-burns">
          <Photo src={src} alt={alt} priority={priority} className="h-full w-full object-cover" />
        </div>
      </motion.div>
    </div>
  );
}
