"use client";

import { useRef } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

type Item = { key: string; href: string; label: string };

/**
 * Mobile navigation in a native <dialog> (built-in focus trap, Esc, inert
 * background) — far lighter than a JS dialog library on every page.
 */
export function MobileMenu({
  siteName,
  items,
  labels,
}: {
  siteName: string;
  items: Item[];
  labels: { open: string; close: string; nav: string; post: string; login: string };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label={labels.open}
        aria-haspopup="dialog"
        className="tap inline-flex items-center justify-center rounded-lg hover:bg-muted lg:hidden"
      >
        <Menu className="size-6" aria-hidden="true" />
      </button>
      <dialog
        ref={ref}
        aria-label={siteName}
        onClick={(e) => e.target === ref.current && close()}
        className="m-0 ml-auto h-dvh max-h-none w-[min(20rem,85vw)] bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <p className="font-semibold">{siteName}</p>
          <button type="button" onClick={close} aria-label={labels.close} className="tap inline-flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={labels.nav} className="flex flex-col gap-1 p-4">
          {items.map((item) => (
            <Link key={item.key} href={item.href} onClick={close} className="tap flex items-center rounded-lg px-3 text-base font-medium hover:bg-muted">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-3 px-4">
          <LanguageSwitcher className="self-start" />
          <Link href="/dashboard/post" onClick={close} className="tap inline-flex items-center justify-center rounded-xl bg-saffron px-4 font-semibold text-saffron-foreground">
            {labels.post}
          </Link>
          <Link href="/login" onClick={close} className="tap inline-flex items-center justify-center rounded-xl border px-4 font-semibold">
            {labels.login}
          </Link>
        </div>
      </dialog>
    </>
  );
}
