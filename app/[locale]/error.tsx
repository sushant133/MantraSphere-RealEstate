"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("error");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-primary">{t("title")}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t("description")}</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p> : null}
      <Button onClick={reset} className="tap mt-8">
        {t("retry")}
      </Button>
    </div>
  );
}
