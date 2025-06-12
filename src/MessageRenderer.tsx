import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MessageRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function MessageRenderer({ content, isStreaming }: MessageRendererProps) {
  if (isStreaming && !content) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-sm">Thinking...</span>
      </div>
    );
  }

  const renderContent = (text: string) => {
    const parts = [];
    let currentIndex = 0;

    // First, handle all complete code blocks
    const completeCodeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = completeCodeBlockRegex.exec(text)) !== null) {
      // Add text before this code block
      if (match.index > currentIndex) {
        const beforeText = text.slice(currentIndex, match.index);
        parts.push(renderMarkdown(beforeText));
      }

      // Add the complete code block
      const language = match[1] || 'text';
      const code = match[2];
      parts.push(
        <div key={match.index} className="my-4">
          <div className="bg-gray-800 text-gray-300 px-3 py-2 text-xs font-medium rounded-t-lg border-b border-gray-600">
            {language}
          </div>
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            customStyle={{
              margin: 0,
              borderRadius: '0 0 8px 8px',
              fontSize: '14px',
              lineHeight: '1.5',
              background: '#1a1a2e',
            }}
            showLineNumbers={code.split('\n').length > 5}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );

      currentIndex = match.index + match[0].length;
    }

    // Handle remaining text, including potential incomplete code blocks
    if (currentIndex < text.length) {
      const remainingText = text.slice(currentIndex);
      
      // Check for incomplete code block pattern during streaming
      if (isStreaming) {
        // Look for patterns like: ```javascript\ncode... or ```\ncode...
        const incompleteCodeMatch = remainingText.match(/^```(\w+)?\n?([\s\S]*)$/);
        
        if (incompleteCodeMatch) {
          const language = incompleteCodeMatch[1] || 'text';
          const incompleteCode = incompleteCodeMatch[2];
          
          // Show as code block if we have a language specified or there's actual code content
          if (incompleteCodeMatch[1] || incompleteCode.trim().length > 0) {
            parts.push(
              <div key="streaming-code" className="my-4">
                <div className="bg-gray-800 text-gray-300 px-3 py-2 text-xs font-medium rounded-t-lg border-b border-gray-600">
                  {language}
                </div>
                <SyntaxHighlighter
                  language={language}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    borderRadius: '0 0 8px 8px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    background: '#1a1a2e',
                  }}
                  showLineNumbers={incompleteCode.split('\n').length > 5}
                >
                  {incompleteCode}
                </SyntaxHighlighter>
              </div>
            );
          } else {
            // Just starting the code block, show as regular text for now
            parts.push(renderMarkdown(remainingText));
          }
        } else {
          // Regular text
          parts.push(renderMarkdown(remainingText));
        }
      } else {
        // Not streaming, treat as regular text
        parts.push(renderMarkdown(remainingText));
      }
    }

    return parts.length > 0 ? parts : [renderMarkdown(text)];
  };

  const components: Components = {
    // Style headings
    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4" {...props} />,
    h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-3" {...props} />,
    h3: ({ node, ...props }) => <h3 className="text-lg font-bold mb-2" {...props} />,
    h4: ({ node, ...props }) => <h4 className="text-base font-bold mb-2" {...props} />,
    h5: ({ node, ...props }) => <h5 className="text-sm font-bold mb-1" {...props} />,
    h6: ({ node, ...props }) => <h6 className="text-xs font-bold mb-1" {...props} />,
    
    // Style paragraphs
    p: ({ node, ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
    
    // Style lists
    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4" {...props} />,
    li: ({ node, ...props }) => <li className="mb-1" {...props} />,
    
    // Style links
    a: ({ node, ...props }) => (
      <a
        className="text-purple-400 hover:text-purple-300 underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
    
    // Style inline code
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const codeContent = React.Children.toArray(children)
        .map(child => typeof child === 'string' ? child : '')
        .join('');
      
      return !inline ? (
        <SyntaxHighlighter
          language={match ? match[1] : 'text'}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.5',
            background: '#1a1a2e',
          } as any}
          showLineNumbers={codeContent.split('\n').length > 5}
          {...props}
        >
          {codeContent}
        </SyntaxHighlighter>
      ) : (
        <code
          className="bg-gray-700 text-purple-300 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-600"
          {...props}
        >
          {children}
        </code>
      );
    },
    
    // Style blockquotes
    blockquote: ({ node, ...props }) => (
      <blockquote
        className="border-l-4 border-purple-500 pl-4 italic my-4 text-gray-300"
        {...props}
      />
    ),
    
    // Style horizontal rule
    hr: ({ node, ...props }) => (
      <hr className="my-6 border-t border-gray-600" {...props} />
    ),
    
    // Style tables
    table: ({ node, ...props }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-gray-600" {...props} />
      </div>
    ),
    thead: ({ node, ...props }) => (
      <thead className="bg-gray-800" {...props} />
    ),
    tbody: ({ node, ...props }) => (
      <tbody className="divide-y divide-gray-600" {...props} />
    ),
    tr: ({ node, ...props }) => (
      <tr className="hover:bg-gray-800" {...props} />
    ),
    th: ({ node, ...props }) => (
      <th className="px-4 py-2 text-left text-sm font-medium text-gray-300" {...props} />
    ),
    td: ({ node, ...props }) => (
      <td className="px-4 py-2 text-sm text-gray-200" {...props} />
    ),
  };

  const renderMarkdown = (text: string) => {
    return (
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={components}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <div className="text-sm leading-relaxed text-gray-200">
      {renderContent(content)}
      {isStreaming && content && (
        <span className="inline-block w-2 h-4 bg-purple-500 ml-1 animate-pulse rounded-sm" />
      )}
    </div>
  );
}
