import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { characterStyle } from "@/components/characters/character-card";
import { linkKey, slugifyHeading, WIKI_PREFIX, wikiLinksToMarkdown, wikiTarget, type LinkLookup } from "@/lib/lore/links";
import { CreateEntryButton } from "./create-entry-button";

// wiki: is ours. Everything else goes through the default, which strips javascript: and the like.
const allowWikiLinks = (url: string) => (url.startsWith(WIKI_PREFIX) ? url : defaultUrlTransform(url));

const textOf = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node.props as { children?: ReactNode }).children);
  return "";
};

function WikiChip({ target, label, lookup }: { target: string; label: ReactNode; lookup: LinkLookup }) {
  const found = lookup.get(linkKey(target));

  if (!found) {
    return (
      <span className="wiki-missing">
        {label}
        <span className="wiki-missing-note">no entry yet</span>
        <CreateEntryButton title={target} />
      </span>
    );
  }

  return (
    <Link
      href={found.href}
      className="wiki-chip"
      data-kind-link={found.kind}
      style={found.kind === "character" ? characterStyle(found.color) : undefined}
    >
      {label}
    </Link>
  );
}

function headingComponent(Tag: "h2" | "h3") {
  return function Heading({ children }: ComponentProps<"h2">) {
    return <Tag id={slugifyHeading(textOf(children))}>{children}</Tag>;
  };
}

/** Raw HTML in the text is shown as text, never run: react-markdown leaves it out. */
export function LoreMarkdown({ body, lookup }: { body: string; lookup: LinkLookup }) {
  const components: Components = {
    h2: headingComponent("h2"),
    h3: headingComponent("h3"),
    a({ href, children }) {
      if (href?.startsWith(WIKI_PREFIX)) return <WikiChip target={wikiTarget(href)} label={children} lookup={lookup} />;
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    },
    img({ src, alt }) {
      // eslint-disable-next-line @next/next/no-img-element -- writers paste any size, from any host
      return typeof src === "string" ? <img src={src} alt={alt ?? ""} loading="lazy" /> : null;
    },
    table({ children }) {
      return (
        <div className="lore-table">
          <table>{children}</table>
        </div>
      );
    },
  };

  return (
    <div className="lore-prose">
      <Markdown remarkPlugins={[remarkGfm]} urlTransform={allowWikiLinks} components={components}>
        {wikiLinksToMarkdown(body)}
      </Markdown>
    </div>
  );
}
