import React, { useState, useEffect } from 'react';
import { ClickUpExportMode, Slide, ClickUpHierarchyList, IntegrationConfig } from '../types';
import { Layers, UploadCloud, AlertCircle, X, ExternalLink, RefreshCw, List, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { extractListId, getAllClickUpLists } from '../services/clickUpService';
import { generateAIReportMetadata } from '../services/geminiService';

interface ClickUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (mode: ClickUpExportMode, listId: string, title: string, description: string) => void;
  loading: boolean;
  slides: Slide[];
  activeSlideId: string;
  error?: string | null;
}

export const ClickUpModal: React.FC<ClickUpModalProps> = ({
  isOpen,
  onClose,
  onExport,
  loading,
  slides,
  activeSlideId,
  error
}) => {
  const [mode, setMode] = useState<ClickUpExportMode>('current');
  const [listId, setListId] = useState('');
  const [availableLists, setAvailableLists] = useState<ClickUpHierarchyList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  
  // Content State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const activeSlide = slides.find(s => s.id === activeSlideId) || slides[0];

  useEffect(() => {
    if (isOpen) {
        // 1. Load Config & Lists
        const globalConfig = localStorage.getItem('bugsnap_config');
        if (globalConfig) {
            const parsed: IntegrationConfig = JSON.parse(globalConfig);
            if (parsed.clickUpListId) setListId(parsed.clickUpListId);
            
            if (parsed.clickUpToken) {
                fetchLists(parsed.clickUpToken);
            }
        }

        // 2. Generate AI Metadata
        generateAIContent();
    }
  }, [isOpen, activeSlideId]); // Regenerate if active slide changes (if single mode)

  const fetchLists = async (token: string) => {
      setIsLoadingLists(true);
      try {
          const lists = await getAllClickUpLists(token);
          setAvailableLists(lists);
      } catch (e) {
          console.error("Failed to load lists in modal", e);
      } finally {
          setIsLoadingLists(false);
      }
  };

  const generateAIContent = async () => {
      setIsGeneratingAI(true);
      try {
          const targetSlide = mode === 'current' ? activeSlide : slides[0]; // Simple logic: use first slide for master description if 'all'
          // If 'all', ideally we summarize all. For now let's use the active one or a generic "All Slides" summary logic?
          // The prompt in generateAIReportMetadata handles single slide data.
          // Let's pass the active slide data.
          
          const meta = await generateAIReportMetadata(
              mode === 'current' ? targetSlide.name : `Bug Report (${slides.length} slides)`,
              mode === 'current' ? targetSlide.annotations : slides.flatMap(s => s.annotations)
          );
          
          setTitle(meta.title);
          setDescription(meta.description);
      } catch (e) {
          console.error("AI Generation failed", e);
      } finally {
          setIsGeneratingAI(false);
      }
  };

  if (!isOpen) return null;

  const isCorsDemoError = error?.includes('corsdemo');
  const cleanError = error?.replace(/ClickUp API Error: \d+ - /, '');

  const handleExport = () => {
      if (!listId) return;
      
      // Save the used List ID as preference
      const globalConfig = localStorage.getItem('bugsnap_config');
      if (globalConfig) {
         const parsed = JSON.parse(globalConfig);
         parsed.clickUpListId = listId;
         // Find name
         const listObj = availableLists.find(l => l.id === listId);
         if (listObj) parsed.clickUpListName = listObj.name;
         
         localStorage.setItem('bugsnap_config', JSON.stringify(parsed));
      }

      onExport(mode, listId, title, description);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#7B68EE] p-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Layers size={20} />
            <span>Export to ClickUp</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
              {isCorsDemoError ? (
                 <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2 text-red-800 font-bold">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>Proxy Activation Required</span>
                    </div>
                    <p className="text-red-700">
                        The browser security proxy (cors-anywhere) requires a one-time verification.
                    </p>
                    <div className="mt-2 space-y-2">
                        <a 
                            href="https://cors-anywhere.herokuapp.com/corsdemo" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-red-100 hover:bg-red-200 text-red-900 py-2 rounded font-medium transition-colors"
                        >
                            <ExternalLink size={14} /> 1. Click here to Unlock Proxy
                        </a>
                        <button 
                            onClick={handleExport}
                            className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium transition-colors"
                        >
                            <RefreshCw size={14} /> 2. Retry Export
                        </button>
                    </div>
                 </div>
              ) : (
                 <div className="flex flex-col gap-1 text-red-700 break-words">
                    <div className="flex items-start gap-2 font-bold">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>Export Failed</span>
                    </div>
                    <span className="pl-6">{cleanError || error}</span>
                 </div>
              )}
            </div>
          )}

          {!isCorsDemoError && (
            <div className="space-y-6">
                {/* 1. List Selection */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Destination List</label>
                    <div className="relative">
                        <select
                            className="w-full border-slate-300 rounded-lg shadow-sm focus:border-[#7B68EE] focus:ring-[#7B68EE] p-3 border pr-10 text-sm appearance-none bg-white"
                            value={listId}
                            onChange={(e) => setListId(e.target.value)}
                            disabled={isLoadingLists}
                        >
                            <option value="" disabled>Select a ClickUp List...</option>
                            {availableLists.map(list => (
                                <option key={list.id} value={list.id}>
                                    {list.groupName} &gt; {list.name}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-3.5 text-slate-400 pointer-events-none flex items-center gap-2">
                            {isLoadingLists && <Loader2 size={16} className="animate-spin text-[#7B68EE]" />}
                            <List size={16} />
                        </div>
                    </div>
                </div>

                {/* 2. AI Content Preview */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                         <div className="flex items-center gap-2 text-[#7B68EE]">
                            <Sparkles size={16} />
                            <span className="text-sm font-bold">Smart Task Details</span>
                         </div>
                         <button 
                            onClick={generateAIContent}
                            disabled={isGeneratingAI}
                            className="text-xs flex items-center gap-1 text-slate-500 hover:text-[#7B68EE]"
                         >
                            <RefreshCw size={12} className={isGeneratingAI ? "animate-spin" : ""} />
                            Regenerate
                         </button>
                    </div>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Task Title</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full text-sm font-semibold border-slate-300 rounded-md focus:border-[#7B68EE] focus:ring-[#7B68EE]"
                                    placeholder="Loading title..."
                                    disabled={isGeneratingAI}
                                />
                                {isGeneratingAI && <div className="absolute right-2 top-2.5"><Loader2 size={14} className="animate-spin text-slate-400"/></div>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                            <div className="relative">
                                <textarea 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={6}
                                    className="w-full text-sm border-slate-300 rounded-md focus:border-[#7B68EE] focus:ring-[#7B68EE]"
                                    placeholder="Loading description..."
                                    disabled={isGeneratingAI}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Export Mode */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Export Mode</h3>
                    <div className="grid grid-cols-1 gap-2">
                        <label className={`cursor-pointer p-3 rounded-lg border flex items-center gap-3 transition-all ${mode === 'current' ? 'border-[#7B68EE] bg-[#7B68EE]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="exportMode" value="current" checked={mode === 'current'} onChange={() => setMode('current')} className="text-[#7B68EE] focus:ring-[#7B68EE]" />
                            <span className="text-sm font-medium text-slate-700">Current Slide Only</span>
                        </label>
                        <label className={`cursor-pointer p-3 rounded-lg border flex items-center gap-3 transition-all ${mode === 'all_attachments' ? 'border-[#7B68EE] bg-[#7B68EE]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="exportMode" value="all_attachments" checked={mode === 'all_attachments'} onChange={() => setMode('all_attachments')} className="text-[#7B68EE] focus:ring-[#7B68EE]" />
                            <span className="text-sm font-medium text-slate-700">All Slides (Attachments)</span>
                        </label>
                        <label className={`cursor-pointer p-3 rounded-lg border flex items-center gap-3 transition-all ${mode === 'all_subtasks' ? 'border-[#7B68EE] bg-[#7B68EE]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="exportMode" value="all_subtasks" checked={mode === 'all_subtasks'} onChange={() => setMode('all_subtasks')} className="text-[#7B68EE] focus:ring-[#7B68EE]" />
                            <span className="text-sm font-medium text-slate-700">All Slides (Subtasks)</span>
                        </label>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition text-sm"
          >
            Cancel
          </button>
          
          {!isCorsDemoError && (
             <button 
               onClick={handleExport}
               disabled={loading || !listId || isGeneratingAI}
               className="px-6 py-2 bg-[#7B68EE] hover:bg-[#6c5ce7] text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
             >
               {loading ? (
                 <>
                   <Loader2 size={16} className="animate-spin" />
                   Sending...
                 </>
               ) : (
                 <>
                   <UploadCloud size={16} />
                   Export
                 </>
               )}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};