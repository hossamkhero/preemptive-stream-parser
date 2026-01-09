import { useState, useEffect, useRef } from 'react';
import { MarkdownStreamParser, ParsedMDNode } from '../lib/MDStreamParser';

interface MarkdownStreamRendererProps {
    content?: string | null;
}

// Utility function to unescape common escaped characters
const unescapeContent = (content?: string | null): string => {
    if (!content) return '';
    return content
        .replace(/\\"/g, '"')        // Unescape quotes
        .replace(/\\'/g, "'")        // Unescape single quotes
        .replace(/\\n/g, '\n')       // Unescape newlines
        .replace(/\\t/g, '\t')       // Unescape tabs
        .replace(/\\r/g, '\r')       // Unescape carriage returns
        .replace(/\\\\/g, '\\')      // Unescape backslashes
        .replace(/\\b/g, '\b')       // Unescape backspace
        .replace(/\\f/g, '\f');      // Unescape form feed
};

const renderNode = (node: ParsedMDNode | string, key: string): React.ReactNode => {
    if (typeof node === 'string') {
        return node;
    }

    const { element, children, attributes } = node;
    const props = attributes.reduce<Record<string, any>>((acc: Record<string, any>, attr: Record<string, any>) => ({ ...acc, ...attr }), {} as Record<string, any>);

    // Simple helper to render children, filtering out whitespace-only strings
    const renderChildren = (kids: (ParsedMDNode | string)[], keyPrefix: string): React.ReactNode[] => {
        return kids
            .filter((child) => typeof child !== 'string' || !/^\s*$/.test(child as string))
            .map((child, idx) => renderNode(child, `${keyPrefix}-${idx}`));
    };

    // Render children recursively
    const renderedChildren = renderChildren(children, key);

    switch (element) {
        case 'root':
            return <div key={key} className="whitespace-pre-wrap break-inside-avoid break-words" {...props}>{renderedChildren}</div>;
        case 'h1':
            return <h1 key={key} className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props}>{renderedChildren}</h1>;
        case 'h2':
            return <h2 key={key} className="text-base font-semibold mb-2 mt-3" {...props}>{renderedChildren}</h2>;
        case 'h3':
            return <h3 key={key} className="text-sm font-semibold mb-1 mt-2" {...props}>{renderedChildren}</h3>;
        case 'h4':
            return <h4 key={key} className="text-sm font-medium mb-1" {...props}>{renderedChildren}</h4>;
        case 'h5':
            return <h5 key={key} className="text-xs font-medium text-gray-800 mb-1" {...props}>{renderedChildren}</h5>;
        case 'h6':
            return <h6 key={key} className="text-xs font-medium text-gray-800 mb-1" {...props}>{renderedChildren}</h6>;
        case 'p':
            return <p key={key} className="text-xs leading-relaxed text-gray-800 mb-2" {...props}>{renderedChildren}</p>;
        case 'strong':
            return <strong key={key} className="font-semibold" {...props}>{renderedChildren}</strong>;
        case 'em':
            return <em key={key} className="italic text-gray-800" {...props}>{renderedChildren}</em>;
        case 'em-strong':
            return <strong key={key} className="font-semibold italic" {...props}>{renderedChildren}</strong>;
        case 'code':
            // Inline code: force normal font weight and no monospaced font
            return <code key={key} className="bg-[hsl(0,0%,95%)] text-slate-700 px-1 py-0.5 rounded-md border-[0.5px] border-[hsl(240,13.6%,93.4%)] font-normal text-xs break-words" {...props}>{renderedChildren}</code>;
        case 'pre':
            return <pre key={key} className="bg-[hsl(0,0%,95%)] border border-[hsl(240,13.6%,93.4%)] rounded-md p-3 overflow-x-auto mb-2 break-words whitespace-pre-wrap" {...props}>{renderedChildren}</pre>;
        case 'del':
            return <del key={key} className="line-through text-gray-500" {...props}>{renderedChildren}</del>;
        case 'ul':
            // ul now contains li elements as children
            return (
                <ul key={key} className="list-disc list-inside ml-1 space-y-1 mb-4" {...props}>
                    {children
                        .filter((child) => typeof child !== 'string' || !/^\s*$/.test(child as string))
                        .map((child: ParsedMDNode | string, cidx: number) => renderNode(child, `${key}-ulchild-${cidx}`))}
                </ul>
            );
        case 'ol':
            // ol now contains li elements as children
            return (
                <ol key={key} className="list-decimal list-inside ml-1 space-y-1 mb-4" {...props}>
                    {children
                        .filter((child) => typeof child !== 'string' || !/^\s*$/.test(child as string))
                        .map((child: ParsedMDNode | string, cidx: number) => renderNode(child, `${key}-olchild-${cidx}`))}
                </ol>
            );
        case 'li':
            // Render list item
            return (
                <li key={key} className="text-gray-800 leading-relaxed break-words" {...props}>
                    {children
                        .filter((child) => typeof child !== 'string' || !/^\s*$/.test(child as string))
                        .map((child: ParsedMDNode | string, cidx: number) => renderNode(child, `${key}-lichild-${cidx}`))}
                </li>
            );
        case 'blockquote':
            return <blockquote key={key} className="border-l-4 border-gray-200 pl-3 py-1 my-2 italic text-xs text-gray-800" {...props}>{renderedChildren}</blockquote>;
        case 'a':
            return <a key={key} href={props.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" {...props}>{renderedChildren}</a>;
        case 'hr':
            return <hr key={key} className="border-t border-gray-200 my-3" {...props} />;
        case 'table':
            return (
                <div key={key} className="overflow-x-auto my-3">
                    <table className="min-w-full border-collapse border border-gray-200 text-xs" {...props}>
                        {children
                            .filter((child) => typeof child !== 'string')
                            .map((child: ParsedMDNode | string, cidx: number) => renderNode(child, `${key}-tablec-${cidx}`))}
                    </table>
                </div>
            );
        case 'thead':
            return (
                <thead key={key} className="bg-gray-50" {...props}>
                    {children
                        .filter((child) => typeof child !== 'string')
                        .map((child: ParsedMDNode | string, cidx: number) => renderNode(child, `${key}-theadc-${cidx}`))}
                </thead>
            );
        case 'tbody':
            return (
                <tbody key={key} className="divide-y divide-gray-200" {...props}>
                    {children
                        .filter((child) => typeof child !== 'string')
                        .map((child: ParsedMDNode | string, cidx: number) => renderNode(child, `${key}-tbodyc-${cidx}`))}
                </tbody>
            );
        case 'tr':
            // Filter out empty cells (cells with only whitespace content)
            const filteredCells = children.filter((child) => {
                if (typeof child === 'string') return false;
                const cell = child as ParsedMDNode;
                if (cell.element !== 'td' && cell.element !== 'th') return true;
                const cellText = cell.children.join('').trim();
                return cellText.length > 0;
            });
            // Don't render empty rows
            if (filteredCells.length === 0) return null;
            return (
                <tr key={key} className="hover:bg-gray-50 transition-colors" {...props}>
                    {filteredCells.map((child: ParsedMDNode | string, cidx: number) => renderNode(child, `${key}-trc-${cidx}`))}
                </tr>
            );
        case 'th':
            return (
                <th key={key} className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-200" {...props}>
                    {renderedChildren}
                </th>
            );
        case 'td':
            return (
                <td key={key} className="px-3 py-2 text-gray-600 border border-gray-200" {...props}>
                    {renderedChildren}
                </td>
            );
        default:
            return <span key={key} className="text-xs text-gray-800" {...props}>{renderedChildren}</span>;
    }
};

export const MarkdownStreamRenderer: React.FC<MarkdownStreamRendererProps> = ({ content }) => {
    const [parsedTree, setParsedTree] = useState<ParsedMDNode | null>(null);

    const parser = useRef<MarkdownStreamParser>(new MarkdownStreamParser());

    useEffect(() => {
        parser.current.clearAllStates();

        // Clean the escaped content before parsing
        const cleanedContent = unescapeContent(content);
        parser.current.parse(cleanedContent);
        setParsedTree(parser.current.root);

        return () => {
            parser.current.clearAllStates();
        }
    }, [content]);

    if (!parsedTree) {
        return null;
    }

    return (
        <div>
            {renderNode(parsedTree, 'root')}
        </div>
    );
}; 