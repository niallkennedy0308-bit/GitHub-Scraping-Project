"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import "github-markdown-css/github-markdown-dark.css";

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "picture"],
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height", "loading"],
    source: [...(defaultSchema.attributes?.source ?? []), "src", "type", "media"],
  },
};

function resolveReadmeUrl(login: string, url: string | undefined, kind: "img" | "a") {
  const value = (url || "").trim();
  if (!value || /^(javascript|data|vbscript):/i.test(value)) return "";
  if (value.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(value)) return value;
  const path = value.replace(/^(\.\/)+/, "").replace(/^\//, "");
  const owner = encodeURIComponent(login);
  if (kind === "img") {
    return `https://raw.githubusercontent.com/${owner}/${owner}/HEAD/${path}`;
  }
  return `https://github.com/${owner}/${owner}/blob/HEAD/${path}`;
}

export function GithubReadme({ login, markdown }: { login: string; markdown: string }) {
  const components: Components = {
    a: ({ href, children, node: _node, ...props }) => {
      const url = resolveReadmeUrl(login, href, "a");
      const external = /^https?:/i.test(url);
      return (
        <a
          {...props}
          href={url || undefined}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer noopener" : undefined}
        >
          {children}
        </a>
      );
    },
    img: ({ src, alt, node: _node, ...props }) => {
      const url = resolveReadmeUrl(login, typeof src === "string" ? src : undefined, "img");
      if (!url) return null;
      return <img {...props} src={url} alt={alt || ""} />;
    },
  };

  return (
    <article className="markdown-body portal-readme">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        urlTransform={(url) => url}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
