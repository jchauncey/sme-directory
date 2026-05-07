import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

type Props = { source: string };

const components: Components = {
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props}>{children}</table>
    </div>
  ),
  pre: ({ children, ...props }) => (
    <pre tabIndex={0} {...props}>
      {children}
    </pre>
  ),
};

export function MarkdownBody({ source }: Props) {
  return (
    <div className="prose prose-zinc max-w-none text-sm dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
