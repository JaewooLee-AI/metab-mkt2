import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushList = (key: string) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 my-2 space-y-1 text-slate-300">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  const flushTable = (key: string) => {
    if (tableRows.length > 0 || tableHeaders.length > 0) {
      elements.push(
        <div key={`table-container-${key}`} className="my-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-900/80 text-brand-orange uppercase text-xs border-b border-slate-800">
              <tr>
                {tableHeaders.map((header, idx) => (
                  <th key={`th-${idx}`} className="px-4 py-3 font-semibold border-r border-slate-800 last:border-r-0">
                    {parseInlineMarkdown(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tableRows.map((row, rowIdx) => (
                <tr key={`tr-${rowIdx}`} className="hover:bg-slate-900/40 bg-slate-950/20 odd:bg-slate-900/20">
                  {row.map((cell, cellIdx) => (
                    <td key={`td-${cellIdx}`} className="px-4 py-3 align-top border-r border-slate-800 last:border-r-0 text-slate-300 leading-relaxed">
                      {parseInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  // Helper to parse bold, inline code, links, and line breaks
  function parseInlineMarkdown(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let currentText = text.trim();
    
    // Replace <br> or <br/> tags with React line breaks
    const brSplit = currentText.split(/<br\s*\/?>/i);
    
    brSplit.forEach((subPart, subIdx) => {
      if (subIdx > 0) {
        parts.push(<br key={`br-${subIdx}`} />);
      }
      
      // Process bold and inline code
      let tempText = subPart;
      let keyCounter = 0;
      
      // Basic regex parsing for bold (**text**) and code (`code`)
      const tokens = tempText.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g);
      
      tokens.forEach((token, idx) => {
        if (token.startsWith('**') && token.endsWith('**')) {
          parts.push(<strong key={`bold-${idx}-${keyCounter++}`} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
        } else if (token.startsWith('`') && token.endsWith('`')) {
          parts.push(<code key={`code-${idx}-${keyCounter++}`} className="bg-slate-800 px-1.5 py-0.5 rounded text-brand-orange text-xs font-mono">{token.slice(1, -1)}</code>);
        } else if (token.startsWith('[') && token.includes('](')) {
          // Link [Text](URL)
          const match = token.match(/\[(.*?)\]\((.*?)\)/);
          if (match) {
            parts.push(
              <a 
                key={`link-${idx}-${keyCounter++}`} 
                href={match[2]} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-brand-orange hover:underline inline-flex items-center font-medium"
              >
                {match[1]}
              </a>
            );
          } else {
            parts.push(token);
          }
        } else {
          parts.push(token);
        }
      });
    });

    return parts;
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    const lineKey = `${index}`;

    // Handle Tables
    if (trimmedLine.startsWith('|')) {
      flushList(lineKey);
      inTable = true;
      
      // Split cells
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      
      // Skip separator lines (e.g. | :--- | :--- |)
      if (cells.every(cell => cell.match(/^:?-+:?$/))) {
        return;
      }
      
      if (tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    } else {
      if (inTable) {
        flushTable(lineKey);
      }
    }

    // Handle Headers
    if (trimmedLine.startsWith('# ')) {
      flushList(lineKey);
      elements.push(
        <h1 key={lineKey} className="text-xl md:text-2xl font-bold text-white mt-6 mb-3 border-b border-slate-800 pb-2">
          {parseInlineMarkdown(trimmedLine.slice(2))}
        </h1>
      );
    } else if (trimmedLine.startsWith('## ')) {
      flushList(lineKey);
      elements.push(
        <h2 key={lineKey} className="text-lg md:text-xl font-semibold text-white mt-5 mb-2.5">
          {parseInlineMarkdown(trimmedLine.slice(3))}
        </h2>
      );
    } else if (trimmedLine.startsWith('### ')) {
      flushList(lineKey);
      elements.push(
        <h3 key={lineKey} className="text-md md:text-lg font-medium text-brand-orange mt-4 mb-2">
          {parseInlineMarkdown(trimmedLine.slice(4))}
        </h3>
      );
    } 
    // Handle Blockquotes
    else if (trimmedLine.startsWith('> ')) {
      flushList(lineKey);
      elements.push(
        <blockquote key={lineKey} className="border-l-4 border-brand-orange/80 bg-slate-900/60 px-4 py-3 my-3 text-slate-300 italic text-sm rounded-r">
          {parseInlineMarkdown(trimmedLine.slice(2))}
        </blockquote>
      );
    }
    // Handle Bullet Lists
    else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      currentList.push(
        <li key={`li-${index}`} className="text-sm">
          {parseInlineMarkdown(trimmedLine.slice(2))}
        </li>
      );
    }
    // Handle Empty Line
    else if (trimmedLine === '') {
      flushList(lineKey);
      // Optional: push a small space, but typically margin on block elements is enough
    }
    // Regular paragraph
    else {
      flushList(lineKey);
      elements.push(
        <p key={lineKey} className="text-sm md:text-base text-slate-300 leading-relaxed mb-3">
          {parseInlineMarkdown(line)}
        </p>
      );
    }
  });

  // Flush any remaining active lists or tables
  flushList('final');
  flushTable('final');

  return <div className="markdown-body space-y-1 text-left">{elements}</div>;
};
