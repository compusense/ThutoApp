'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Image from 'next/image';

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-lg dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-3xl font-bold mt-8 mb-4 text-primary">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-bold mt-6 mb-3 text-primary">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-semibold mt-5 mb-2">{children}</h3>,
          p: ({ node, children }) => {
            if (
              node &&
              node.children.length === 1 &&
              node.children[0].type === 'text' &&
              node.children[0].value.startsWith('[Illustration:')
            ) {
              const text = node.children[0].value;
              const alt = text.slice(14, -1);
              return (
                <div className="my-8 text-center">
                  <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-8 inline-block">
                    <div className="bg-gray-200 border-2 border-dashed rounded-xl w-96 h-64 mx-auto flex items-center justify-center text-gray-600 font-medium">
                      {alt}
                    </div>
                    <p className="mt-2 text-sm italic text-muted-foreground">Illustration: {alt}</p>
                  </div>
                </div>
              );
            }
             // Check for paragraphs that are just images, to avoid wrapping them in a <p> tag which adds margins
            if (node && node.children.length === 1 && node.children[0].type === 'element' && node.children[0].tagName === 'img') {
                const image = node.children[0];
                return (
                    <span className="block my-6 text-center">
                        <Image
                            className="max-w-full lg:max-w-[75%] rounded-lg mx-auto shadow-md"
                            src={image.properties?.src as string || ''}
                            alt={(image.properties?.alt as string) || 'Note image'}
                            width={600}
                            height={400}
                            unoptimized // Since we don't know the remote hostnames in advance
                        />
                        {image.properties?.alt && <p className="mt-2 text-sm italic text-muted-foreground">{image.properties.alt as string}</p>}
                    </span>
                );
            }
            return <p className="mb-4 leading-relaxed">{children}</p>;
          },
          img: ({ node, ...props }) => (
            <span className="block my-6 text-center">
                <Image
                    className="max-w-full lg:max-w-[75%] rounded-lg mx-auto shadow-md"
                    src={props.src || ''}
                    alt={props.alt || 'Note image'}
                    width={600}
                    height={400}
                    unoptimized
                />
                {props.alt && <p className="mt-2 text-sm italic text-muted-foreground">{props.alt}</p>}
            </span>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
          strong: ({ children }) => <strong className="font-bold text-primary">{children}</strong>,
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
