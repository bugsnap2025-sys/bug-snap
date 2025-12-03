
import React, { useState, useEffect } from 'react';
import { TrelloExportMode, Slide, TrelloBoard, TrelloList, IntegrationConfig } from '../types';
import { Trello, UploadCloud, AlertCircle, X, ExternalLink, RefreshCw, Loader2, Sparkles, Check, FileStack, Image as ImageIcon, Briefcase, ArrowRight, List } from 'lucide-react';
import { getTrelloBoards, getTrelloLists } from '../services/trelloService';
import { generateAIReportMetadata } from '../services/geminiService';

interface TrelloModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (mode: TrelloExportMode, listId: string, title: string, description: string) => void;
  loading: boolean;
  slides: Slide[];
  activeSlideId: string;
  error?: string | null;
  onConfigure?: () => void;
}

export const TrelloModal: React.FC<TrelloModalProps> = ({
  isOpen,
  onClose,
  onExport,
  loading,
  slides,
  activeSlideId,
  error,
  onConfigure
}) => {
  const [mode, setMode] = useState<TrelloExportMode>('current');
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  
  // Content State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const activeSlide = slides.find(s => s.id === activeSlideId) || slides[0];

  useEffect(() => {
    if (isOpen) {
        const globalConfig = localStorage.getItem('bugsnap_config');
        if (globalConfig) {
            const parsed: IntegrationConfig = JSON.parse(globalConfig);
            if (!parsed.trelloApiKey || !parsed.trelloToken) {
                setIsConfigured(false);
            } else {
                setIsConfigured(true);
                fetchBoards(parsed.trelloApiKey, parsed.trelloToken);
            }
        } else {
            setIsConfigured(false);
        }
    }
  }, [isOpen]); 

  useEffect(() => {
    if (isOpen && slides.length > 0) {
        generateAIContent();
    }
  }, [isOpen, mode, activeSlideId]);

  const fetchBoards = async (key: string, token: string) => {
      setIsLoadingMeta(true);
      try {
          const fetchedBoards = await getTrelloBoards(key, token);
          setBoards(fetchedBoards);
          if (fetchedBoards.length > 0) {
              const defaultBoard = fetchedBoards[0];
              setSelectedBoardId(defaultBoard.id);
              fetchLists(key, token, defaultBoard.id);
          }
      } catch (e) {
          console.error("Failed to load Trello boards", e);
      } finally {
          setIsLoadingMeta(false);
      }
  };

  const fetchLists = async (key: string, token: string, boardId: string) => {
      try {
          const fetchedLists = await getTrelloLists(key, token, boardId);
          setLists(fetchedLists);
          if (fetchedLists.length > 0) setSelectedListId(fetchedLists[0].id);
      } catch (e) {
          console.error("Failed to load Trello lists", e);
      }
  };

  const handleBoardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newId = e.target.value;
      setSelectedBoardId(newId);
      
      const globalConfig = localStorage.getItem('bugsnap_config');
      if (globalConfig) {
          const config = JSON.parse(globalConfig);
          if (config.trelloApiKey && config.trelloToken) fetchLists(config.trelloApiKey, config.trelloToken, newId);
      }
  };

  const generateAIContent = async () => {
      setIsGeneratingAI(true);
      try {
          const isSingle = mode === 'current';
          const targetSlide = activeSlide; 
          
          const slideName = isSingle ? targetSlide.name : `Bug Report Batch (${slides.length} slides)`;
          const targetAnnotations = isSingle 
             ? targetSlide.annotations 
             : slides.flatMap(s => s.annotations);
          
          const meta = await generateAIReportMetadata(slideName, targetAnnotations);
          
          setTitle(meta.title);
          setDescription(meta.description);
      } catch (e) {
          console.error("AI Generation failed", e);
      } finally {
          setIsGeneratingAI(false);
      }
  };

  if (!isOpen) return null;

  if (!isConfigured) {
      return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#272727] flex flex-col transition-colors">
                <div className="p-6 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-[#0079BF]/10 dark:bg-[#0079BF]/20 text-[#0079BF] rounded-2xl flex items-center justify-center mb-4">
                        <Trello size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Connect Trello</h2>
                    <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">
                        Connect your Trello account to create cards directly from bug reports.
                    </p>
                    <button 
                        onClick={onConfigure}
                        className="w-full py-3 bg-[#0079BF] hover:bg-[#056dae] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
                    >
                        Connect Now <ArrowRight size={18} />
                    </button>
                    <button 
                        onClick={onClose}
                        className="mt-4 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 text-sm font-medium"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
      )
  }

  const isCorsDemoError = error?.includes('corsdemo');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-[#272727] flex flex-col max-h-[90vh] transition-colors">
        
        {/* Header */}
        <div className="bg-white dark:bg-[#1e1e1e] border-b border-slate-100 dark:border-[#272727] p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0079BF] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#0079BF]/20">
               <Trello size={22} />
            </div>
            <div>
               <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Export to Trello</h2>
               <p className="text-xs text-slate-500 dark:text-zinc-400">Create cards in your Board</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#272727] transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm animate-in slide-in-from-top-2">
              {isCorsDemoError ? (
                 <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2 text-red-800 dark:text-red-300 font-bold">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>Proxy Activation Required</span>
                    </div>
                    <p className="text-red-700 dark:text-red-400">
                        The browser security proxy requires one-time verification.
                    </p>
                    <div className="mt-3 flex gap-3">
                        <a 
                            href="https://cors-anywhere.herokuapp.com/corsdemo" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-900 dark:text-red-100 px-4 py-2 rounded-lg font-medium transition-colors text-xs"
                        >
                            <ExternalLink size={14} /> Unlock Proxy
                        </a>
                    </div>
                 </div>
              ) : (
                 <div className="flex flex-col gap-1 text-red-700 dark:text-red-400 break-words">
                    <div className="flex items-start gap-2 font-bold">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>Export Failed</span>
                    </div>
                    <span className="pl-6 opacity-90">{error}</span>
                 </div>
              )}
            </div>
          )}

          {!isCorsDemoError && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                
                {/* Left Column: AI Smart Details */}
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2 text-[#0079BF]">
                            <Sparkles size={18} />
                            <span className="text-sm font-bold uppercase tracking-wide">Card Details (AI)</span>
                         </div>
                         <button 
                            onClick={generateAIContent}
                            disabled={isGeneratingAI}
                            className="text-xs flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 hover:text-[#0079BF] dark:hover:text-[#4daae3] font-medium transition-colors bg-slate-50 dark:bg-[#272727] px-2 py-1 rounded-md"
                         >
                            <RefreshCw size={12} className={isGeneratingAI ? "animate-spin" : ""} />
                            Regenerate
                         </button>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-[#121212] p-1 rounded-2xl border border-slate-200 dark:border-[#3f3f3f] flex-1 flex flex-col">
                        <div className="p-4 space-y-4 flex-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Card Name</label>
                                <div className="relative group">
                                    <input 
                                        type="text" 
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#3f3f3f] text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0079BF] focus:border-transparent outline-none placeholder-slate-300 transition-all shadow-sm group-hover:border-slate-300 dark:group-hover:border-[#555]"
                                        placeholder="Generating title..."
                                        disabled={isGeneratingAI}
                                    />
                                    {isGeneratingAI && <div className="absolute right-3 top-3.5"><Loader2 size={16} className="animate-spin text-[#0079BF]"/></div>}
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col">
                                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Description</label>
                                <div className="relative flex-1 group">
                                    <textarea 
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full h-full min-h-[200px] bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#3f3f3f] text-slate-800 dark:text-zinc-200 rounded-xl p-4 text-sm leading-relaxed focus:ring-2 focus:ring-[#0079BF] focus:border-transparent outline-none placeholder-slate-300 transition-all shadow-sm resize-none group-hover:border-slate-300 dark:group-hover:border-[#555]"
                                        placeholder="Generating description..."
                                        disabled={isGeneratingAI}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Settings & Destination */}
                <div className="flex flex-col gap-6">
                    
                    {/* Board */}
                    <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2 mb-2">
                            <Briefcase size={16} className="text-slate-400"/> Board
                        </label>
                        <div className="relative">
                            <select
                                className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-xl shadow-sm focus:ring-2 focus:ring-[#0079BF] focus:border-transparent p-3.5 pl-4 pr-10 text-sm font-medium appearance-none text-slate-700 dark:text-zinc-200 outline-none transition-colors cursor-pointer hover:border-[#0079BF]"
                                value={selectedBoardId}
                                onChange={handleBoardChange}
                                disabled={isLoadingMeta}
                            >
                                {boards.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                                {boards.length === 0 && <option value="" disabled>Loading Boards...</option>}
                            </select>
                            <div className="absolute right-4 top-4 text-slate-400 pointer-events-none flex items-center gap-2">
                                {isLoadingMeta ? <Loader2 size={16} className="animate-spin text-[#0079BF]" /> : <div className="border-l border-slate-200 dark:border-[#3f3f3f] pl-3 text-xs font-bold text-slate-300">▼</div>}
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2 mb-2">
                            <List size={16} className="text-slate-400"/> List
                        </label>
                        <div className="relative">
                            <select
                                className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-xl shadow-sm focus:ring-2 focus:ring-[#0079BF] focus:border-transparent p-3.5 pl-4 pr-10 text-sm font-medium appearance-none text-slate-700 dark:text-zinc-200 outline-none transition-colors cursor-pointer hover:border-[#0079BF]"
                                value={selectedListId}
                                onChange={(e) => setSelectedListId(e.target.value)}
                                disabled={isLoadingMeta}
                            >
                                {lists.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                                {lists.length === 0 && <option value="" disabled>Loading Lists...</option>}
                            </select>
                             <div className="absolute right-4 top-4 text-slate-400 pointer-events-none flex items-center gap-2">
                                <div className="border-l border-slate-200 dark:border-[#3f3f3f] pl-3 text-xs font-bold text-slate-300">▼</div>
                            </div>
                        </div>
                    </div>

                    {/* Export Mode Cards */}
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                            <FileStack size={16} className="text-slate-400"/> Attachments
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {/* Card 1: Current Slide */}
                            <div 
                                onClick={() => setMode('current')}
                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative group ${mode === 'current' ? 'border-[#0079BF] bg-[#0079BF]/5 dark:bg-[#0079BF]/10 shadow-md' : 'border-slate-100 dark:border-[#272727] bg-white dark:bg-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#444]'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${mode === 'current' ? 'bg-[#0079BF] text-white' : 'bg-slate-100 dark:bg-[#272727] text-slate-400'}`}>
                                        <ImageIcon size={18} />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-sm mb-1 ${mode === 'current' ? 'text-[#0079BF]' : 'text-slate-700 dark:text-zinc-200'}`}>Current Slide Only</h4>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                                            Create one card with the active screenshot attached.
                                        </p>
                                    </div>
                                    {mode === 'current' && <div className="absolute top-4 right-4 text-[#0079BF]"><Check size={18} strokeWidth={3} /></div>}
                                </div>
                            </div>

                            {/* Card 2: All Attachments */}
                            <div 
                                onClick={() => setMode('all_attachments')}
                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative group ${mode === 'all_attachments' ? 'border-[#0079BF] bg-[#0079BF]/5 dark:bg-[#0079BF]/10 shadow-md' : 'border-slate-100 dark:border-[#272727] bg-white dark:bg-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#444]'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${mode === 'all_attachments' ? 'bg-[#0079BF] text-white' : 'bg-slate-100 dark:bg-[#272727] text-slate-400'}`}>
                                        <FileStack size={18} />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-sm mb-1 ${mode === 'all_attachments' ? 'text-[#0079BF]' : 'text-slate-700 dark:text-zinc-200'}`}>All Slides (Attachments)</h4>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                                            Create one card and attach all {slides.length} screenshots.
                                        </p>
                                    </div>
                                    {mode === 'all_attachments' && <div className="absolute top-4 right-4 text-[#0079BF]"><Check size={18} strokeWidth={3} /></div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-[#272727] bg-slate-50 dark:bg-[#0f0f0f] flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 text-slate-600 dark:text-zinc-400 font-bold hover:bg-slate-200 dark:hover:bg-[#272727] rounded-xl transition text-sm"
          >
            Cancel
          </button>
          
          {!isCorsDemoError && (
             <button 
               onClick={() => onExport(mode, selectedListId, title, description)}
               disabled={loading || !selectedListId || isGeneratingAI}
               className="px-8 py-2.5 bg-[#0079BF] hover:bg-[#056dae] text-white font-bold rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-95"
             >
               {loading ? (
                 <>
                   <Loader2 size={18} className="animate-spin" />
                   Creating Card...
                 </>
               ) : (
                 <>
                   <UploadCloud size={18} />
                   Export to Trello
                 </>
               )}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};
