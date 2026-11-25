'use client';
import * as React from 'react';
import Image from 'next/image';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

/**
 * The real dashboard (screenshots taken from the demo seed) in a browser frame. It starts tilted
 * back and settles flat as it scrolls into view. Static when motion is reduced.
 */
export function ProductPreview({ alt, url }: { alt: string; url: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  return (
    <div ref={ref} className="[perspective:1600px]">
      <motion.div
        style={reduce ? undefined : { rotateX, scale, transformOrigin: 'center bottom' }}
        className="overflow-hidden rounded-xl border bg-surface shadow-[0_40px_80px_-40px_rgba(15,30,61,0.45)] dark:shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]"
      >
        <div className="flex h-9 items-center gap-3 border-b bg-muted/60 px-3" aria-hidden>
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#F87171]" />
            <span className="size-2.5 rounded-full bg-[#FBBF24]" />
            <span className="size-2.5 rounded-full bg-[#34D399]" />
          </div>
          <div className="mx-auto flex h-6 w-full max-w-xs items-center justify-center rounded bg-surface px-3 text-xs text-muted-foreground">
            {url}
          </div>
          <div className="w-10" />
        </div>
        <Image
          src="/product/dashboard-light.webp"
          alt={alt}
          width={1600}
          height={900}
          sizes="(min-width: 1152px) 1104px, 100vw"
          className="block h-auto w-full dark:hidden"
        />
        <Image
          src="/product/dashboard-dark.webp"
          alt={alt}
          width={1600}
          height={900}
          sizes="(min-width: 1152px) 1104px, 100vw"
          className="hidden h-auto w-full dark:block"
        />
      </motion.div>
    </div>
  );
}
