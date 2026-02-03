
import React from 'react';

interface FormattedTextProps {
    text: string;
    className?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ text, className = "" }) => {
    if (!text) return null;

    // Normalize line endings
    const normalizedText = text.replace(/\r\n/g, '\n');
    const lines = normalizedText.split('\n');

    return (
        <div className={`space-y-3 ${className}`}>
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2"></div>;

                // Handle bullet points
                if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
                    const content = trimmed.substring(1).trim();
                    return (
                        <div key={i} className="flex gap-3 pl-2">
                            <span className="text-indigo-500 font-black mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                            <span className="flex-1 text-slate-700 leading-relaxed">{parseBold(content)}</span>
                        </div>
                    );
                }

                // Handle numbered lists
                const numMatch = trimmed.match(/^(\d+\.)\s+(.*)/);
                if (numMatch) {
                    return (
                        <div key={i} className="flex gap-3 pl-2">
                            <span className="text-indigo-600 font-black shrink-0">{numMatch[1]}</span>
                            <span className="flex-1 text-slate-700 leading-relaxed">{parseBold(numMatch[2])}</span>
                        </div>
                    );
                }

                // Handle titles (ends with : or starts with bold)
                if (trimmed.endsWith(':') || (trimmed.startsWith('**') && trimmed.endsWith('**'))) {
                    return <p key={i} className="font-black text-slate-900 mt-6 first:mt-0 text-sm uppercase tracking-wider">{parseBold(trimmed)}</p>;
                }

                return <p key={i} className="leading-relaxed text-slate-700">{parseBold(line)}</p>;
            })}
        </div>
    );
};

function parseBold(text: string) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-black text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
}
