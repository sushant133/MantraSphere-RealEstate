"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sticky header that shrinks after the user scrolls. Height change is CSS-only (no layout shift below). */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        "sticky top-0 z-40 border-b border-transparent bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75",
        "transition-[border-color,box-shadow] duration-200",
        "data-[scrolled]:border-border data-[scrolled]:shadow-sm",
      )}
    >
      <div className="container-wide flex h-16 items-center gap-4 transition-[height] duration-200 md:h-[4.5rem] [[data-scrolled]_&]:h-14 md:[[data-scrolled]_&]:h-16">
        {children}
      </div>
    </header>
  );
}
