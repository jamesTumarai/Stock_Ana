import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  children?: any;
  findings?: any[];
}

function toSafeString(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    return val.map(toSafeString).filter(Boolean).join('\n');
  }
  if (typeof val === 'object') {
    if (typeof val.point === 'string') return val.point;
    if (typeof val.text === 'string') return val.text;
    if (typeof val.description === 'string') return val.description;
    if (typeof val.summary === 'string') return val.summary;
    if (typeof val.content === 'string') return val.content;
    if (typeof val.value === 'string' || typeof val.value === 'number') return String(val.value);
    if (typeof val.title === 'string') {
      const sub = val.description || val.text || val.summary || '';
      return sub ? `**${val.title}**: ${sub}` : val.title;
    }
    try {
      return JSON.stringify(val);
    } catch {
      return '';
    }
  }
  return String(val);
}

export const EnhancedMarkdown: React.FC<Props> = ({ children, findings = [] }) => {
  const safeText = toSafeString(children);

  if (!safeText.trim()) {
    return null;
  }

  // Pre-process text to convert [1] into [1](#citation-1)
  const processedText = safeText.replace(/\[(\d+)\]/g, '[$1](#citation-$1)');

  const components = {
    a: ({ node, href, children, ...props }: any) => {
      if (href?.startsWith('#citation-')) {
        const citationId = parseInt(href.replace('#citation-', ''), 10);
        const index = isNaN(citationId) ? -1 : citationId - 1;
        const finding = index >= 0 && Array.isArray(findings) ? findings[index] : undefined;
        
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

  try {
    return (
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {processedText}
      </Markdown>
    );
  } catch (err) {
    console.warn('[EnhancedMarkdown] Render error fallback:', err);
    return <span>{processedText}</span>;
  }
};
