import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/** CMS Markdown rendered on the server (raw HTML is escaped, see lib/markdown.ts). */
export function Markdown({ source, lang, className }: { source: string; lang?: string; className?: string }) {
  return <div lang={lang} className={cn("md", className)} dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
