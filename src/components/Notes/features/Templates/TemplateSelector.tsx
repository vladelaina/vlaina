/**
 * TemplateSelector - Quick template insertion
 * 
 * Obsidian-style template system
 */

import { useState } from 'react';
import { FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NoteTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  icon?: string;
}

// Built-in templates
export const DEFAULT_TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting',
    name: 'Meeting Notes',
    description: 'Template for meeting notes',
    content: `# Meeting: {{title}}

**Date:** {{date}}
**Attendees:** 

## Agenda
1. 

## Discussion


## Action Items
- [ ] 

## Next Steps

`,
  },
  {
    id: 'project',
    name: 'Project',
    description: 'Template for project documentation',
    content: `# {{title}}

## Overview


## Goals
- 

## Tasks
- [ ] 

## Resources
- 

## Notes

`,
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Template for weekly reviews',
    content: `# Week of {{date}}

## Accomplishments
- 

## Challenges
- 

## Learnings
- 

## Next Week Goals
- [ ] 

## Notes

`,
  },
  {
    id: 'book-notes',
    name: 'Book Notes',
    description: 'Template for book notes and summaries',
    content: `# {{title}}

**Author:** 
**Rating:** ⭐⭐⭐⭐⭐

## Summary


## Key Takeaways
1. 

## Favorite Quotes
> 

## How to Apply

`,
  },
  {
    id: 'blank',
    name: 'Blank Note',
    description: 'Start with a blank note',
    content: `# {{title}}

`,
  },
];

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: NoteTemplate) => void;
  templates?: NoteTemplate[];
}

export function TemplateSelector({ 
  isOpen, 
  onClose, 
  onSelect,
  templates = DEFAULT_TEMPLATES 
}: TemplateSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelect = (template: NoteTemplate) => {
    onSelect(template);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-purple-500" />
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Choose a Template
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
          >
            <X className="size-4 text-zinc-400" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="p-4 grid grid-cols-2 gap-3 max-h-96 overflow-auto">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelect(template)}
              onMouseEnter={() => setSelectedId(template.id)}
              onMouseLeave={() => setSelectedId(null)}
              className={cn(
                "p-4 rounded-lg border text-left transition-all",
                selectedId === template.id
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText 
                  className={cn(
                    "size-5",
                    selectedId === template.id 
                      ? "text-purple-500" 
                      : "text-zinc-400"
                  )} 
                />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {template.name}
                </span>
              </div>
              {template.description && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {template.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Process template variables
 */
export function processTemplate(content: string, variables: Record<string, string>): string {
  let result = content;
  
  // Default variables
  const defaults: Record<string, string> = {
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    title: 'Untitled',
  };
  
  const allVars = { ...defaults, ...variables };
  
  for (const [key, value] of Object.entries(allVars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  return result;
}
