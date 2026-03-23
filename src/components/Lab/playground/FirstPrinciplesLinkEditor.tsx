import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  LINK_EDITOR_CONCEPTS,
  type LinkEditorConcept,
  type LinkInteractionModel,
} from '../variants/linkHandleFirstPrinciples';

// --- Sub-components for Link Editor Models ---

function LinkEditorPreview({
  model,
  url,
  setUrl,
  isEditing,
  onClose,
}: {
  model: LinkInteractionModel;
  url: string;
  setUrl: (v: string) => void;
  isEditing: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const renderEditor = () => {
    switch (model) {
      case 'the-rail':
        return (
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            className="flex flex-col items-center w-full max-w-sm"
          >
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste or type a link..."
              className="w-full bg-transparent border-none text-center text-sm font-light focus:ring-0 placeholder:text-neutral-300"
            />
            <motion.div className="h-px w-full bg-primary/30 mt-1 origin-center" layoutId="rail-line" />
          </motion.div>
        );
      case 'expanding-pill':
        return (
          <motion.div
            layoutId="link-pill"
            className="flex items-center bg-white rounded-full border border-neutral-100 shadow-sm px-4 py-2 overflow-hidden"
            initial={{ width: 40, opacity: 0 }}
            animate={{ width: 'auto', minWidth: 200, opacity: 1 }}
            exit={{ width: 40, opacity: 0 }}
          >
            <div className="mr-2 opacity-40">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                 <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                 <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
               </svg>
            </div>
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL"
              className="flex-1 bg-transparent border-none p-0 text-xs focus:ring-0"
            />
            {url && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={onClose}
                className="ml-2 h-4 w-4 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </motion.button>
            )}
          </motion.div>
        );
      case 'bracket-pair':
        return (
          <div className="flex items-center text-neutral-400 gap-1">
             <span className="text-xl font-light">[</span>
             <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-transparent border-none p-0 text-sm focus:ring-0 text-primary min-w-[120px]"
              placeholder="url"
             />
             <span className="text-xl font-light">]</span>
          </div>
        );
      case 'glass-pane':
        return (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="backdrop-blur-xl bg-white/60 border border-white/40 shadow-xl rounded-2xl px-6 py-4 flex flex-col gap-3"
          >
             <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Edit Connection</div>
             <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-neutral-950/5 border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary/20"
              placeholder="https://..."
             />
          </motion.div>
        );
      case 'chrono-veil':
        return (
          <motion.div
            className="relative p-8 flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
             <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl -z-10" />
             <div className="mb-4 text-xs font-light text-neutral-400">Link Chrono-Trace</div>
             <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-transparent border-none text-2xl font-extralight text-center focus:ring-0"
              placeholder="path/to/sync"
             />
             <div className="mt-4 flex gap-1">
               {[1,2,3,4,5].map(i => (
                 <div key={i} className="h-0.5 w-4 bg-neutral-200" />
               ))}
             </div>
          </motion.div>
        );
      default:
        return (
          <div className="px-4 py-2 bg-neutral-100 rounded text-xs text-neutral-500 italic">
             {model} interaction preview not implemented yet.
          </div>
        );
    }
  };

  return (
    <div className="flex justify-center items-center w-full min-h-[120px]">
      <AnimatePresence mode="wait">
        {isEditing && renderEditor()}
      </AnimatePresence>
    </div>
  );
}

export function FirstPrinciplesLinkEditor() {
  const [activeConcept, setActiveConcept] = useState<LinkEditorConcept>(LINK_EDITOR_CONCEPTS[0]);
  const [url, setUrl] = useState('');
  const [isEditing, setIsEditing] = useState(true);

  // Reset editing state when concept changes to trigger entry animation
  const handleConceptChange = (concept: LinkEditorConcept) => {
    setIsEditing(false);
    setTimeout(() => {
      setActiveConcept(concept);
      setIsEditing(true);
    }, 100);
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#fafafa] p-8 font-sans">
      <header className="mb-12 max-w-2xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">Design Exploration</div>
        <h1 className="mt-4 text-4xl font-light tracking-tight text-neutral-900">{activeConcept.name}</h1>
        <p className="mt-4 text-lg font-light leading-relaxed text-neutral-500 italic">
          &ldquo;{activeConcept.philosophy}&rdquo;
        </p>
      </header>

      <div className="flex flex-1 gap-12 overflow-hidden">
        {/* Concept Selector */}
        <aside className="w-64 overflow-y-auto pr-4 scrollbar-hide border-r border-neutral-100">
          <div className="space-y-8">
            {(['Zen', 'Contextual', 'Tactile', 'Semantic', 'Aesthetic'] as const).map((cat) => (
              <section key={cat}>
                <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">{cat}</h3>
                <div className="flex flex-col gap-1">
                  {LINK_EDITOR_CONCEPTS.filter(c => c.category === cat).map((concept) => (
                    <button
                      key={concept.id}
                      onClick={() => handleConceptChange(concept)}
                      className={cn(
                        "group relative flex items-center px-3 py-2 text-xs transition-all duration-300 rounded-lg",
                        activeConcept.id === concept.id
                          ? "bg-white text-primary shadow-sm ring-1 ring-black/5"
                          : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                      )}
                    >
                      {activeConcept.id === concept.id && (
                        <motion.div
                          layoutId="active-dot"
                          className="absolute left-1 w-1 h-1 bg-primary rounded-full"
                        />
                      )}
                      <span className="ml-2">{concept.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>

        {/* Live Preview Area */}
        <main className="flex-1 flex flex-col justify-center items-center">
          <div className="w-full max-w-xl p-12 rounded-[40px] bg-white shadow-[0_40px_80px_-24px_rgba(0,0,0,0.06)] border border-neutral-50 relative overflow-hidden">
            <div className="absolute top-8 left-10 flex gap-1.5">
               <div className="h-1.5 w-1.5 rounded-full bg-neutral-200" />
               <div className="h-1.5 w-1.5 rounded-full bg-neutral-200" />
            </div>

            <div className="text-center mb-12">
               <span className="text-[10px] font-mono text-neutral-300 uppercase tracking-widest">Prototype Canvas</span>
            </div>

            <LinkEditorPreview
              model={activeConcept.model}
              url={url}
              setUrl={setUrl}
              isEditing={isEditing}
              onClose={() => setUrl('')}
            />

            <div className="mt-12 pt-8 border-t border-neutral-50 flex justify-between items-center px-4">
               <div className="flex flex-col">
                 <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-tighter">Model Type</span>
                 <span className="text-xs font-medium text-neutral-600">{activeConcept.category}</span>
               </div>
               <div className="flex flex-col items-end">
                 <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-tighter">Active State</span>
                 <span className="text-xs font-medium text-primary">Editing...</span>
               </div>
            </div>
          </div>

          <p className="mt-12 max-w-md text-center text-xs leading-relaxed text-neutral-400">
            Interaction is communication. By removing standard UI artifacts like bulky buttons and borders, we focus the user&apos;s intent purely on the connection between text and its destination.
          </p>
        </main>
      </div>
    </div>
  );
}
