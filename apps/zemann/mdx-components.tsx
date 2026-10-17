import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {
  h2: (props) => <h2 className="mt-12 mb-4 text-2xl font-bold text-ink" {...props} />,
  h3: (props) => <h3 className="mt-8 mb-3 text-xl font-semibold text-ink" {...props} />,
  p: (props) => <p className="my-4 leading-relaxed text-ink-soft" {...props} />,
  ul: (props) => <ul className="my-4 list-disc space-y-2 pl-6 text-ink-soft" {...props} />,
  ol: (props) => <ol className="my-4 list-decimal space-y-2 pl-6 text-ink-soft" {...props} />,
  a: (props) => <a className="font-medium text-accent underline underline-offset-2" {...props} />,
  strong: (props) => <strong className="font-semibold text-ink" {...props} />,
  table: (props) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b-2 border-line bg-surface px-3 py-2 font-semibold text-ink" {...props} />,
  td: (props) => <td className="border-b border-line px-3 py-2 align-top text-ink-soft" {...props} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
