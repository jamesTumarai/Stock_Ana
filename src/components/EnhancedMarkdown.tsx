import React, { useState } from 'react';
import Markdown from 'react-markdown';

interface Props {
  children: string;
  findings?: any[];
}

export const EnhancedMarkdown: React.FC<Props> = ({ children, findings = [] }) => {
  // Pre-process text to convert [1] into [1](#citation-1)
  const processedText = children.replace(/\[(\d+)\]/g, '[$1](#citation-$1)');

  const components = {
    a: ({ node, href, children, ...props }: any) => {
      if (href?.startsWith('#citation-')) {
        const index = parseInt(href.replace('#citation-', '')) - 1;
        const finding = findings[index];
        
        return (
          <span className="relative group inline-block">
            <a 
              href={finding?.sourceUrl || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold mx-0.5 hover:bg-blue-200 transition-colors cursor-pointer no-underline"
              {...props}
            >
              {children}
            </a>
            {finding && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-stone-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                <strong className="block text-blue-300 mb-1">{finding.documentType || 'Source'}</strong>
                <span className="line-clamp-3">{finding.keyInsights?.[0] || 'View document for details'}</span>
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-stone-900 rotate-45"></span>
              </span>
            )}
          </span>
        );
      }
      return <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    }
  };

  return (
    <Markdown components={components}>
      {processedText}
    </Markdown>
  );
};
