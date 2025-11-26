
import React, { useState, useEffect } from 'react';
import { ClickUpExportMode, Slide, ClickUpHierarchyList, IntegrationConfig } from '../types';
import { Layers, UploadCloud, AlertCircle, X, ExternalLink, RefreshCw, List, Loader2, Sparkles, Check, FileStack, Image as ImageIcon, ListTree, ArrowRight, HardDrive, ShieldAlert } from 'lucide-react';
import { extractListId, getAllClickUpLists } from '../services/clickUpService';
import { generateAIReportMetadata } from '../services/geminiService';
import { requestDriveToken } from '../services/googleDriveService';

interface ClickUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (mode: ClickUpExportMode, listId: string, title: string, description: string) => void;
  loading: boolean;
  slides: Slide[];
  activeSlideId: string;
  error?: string | null;
  onConfigure?: () => void;
}

export const ClickUpModal: React.FC<ClickUpModalProps> = ({
  isOpen,
  onClose,
  onExport,
  loading,
  slides,
  activeSlideId,
  error,
  onConfigure
}) => {
  const [mode, setMode] = useState<ClickUpExportMode>('current');
  const [listId, setListId] = useState('');
  const [availableLists, setAvailableLists] = useState<ClickUpHierarchyList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  
  // Content State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isAuthorizingDrive, setIsAuthorizingDrive] = useState(false);

  const activeSlide = slides.find(s => s.id === activeSlideId) || slides[0];

  useEffect(() => {
    if (isOpen) {
        // 1. Load Config & Lists
        const globalConfig = localStorage.getItem('bugsnap_config');
        if (globalConfig) {
            const parsed: IntegrationConfig = JSON.parse(globalConfig);
            if (!parsed.clickUpToken) {
                setIsConfigured(false);
            } else {
                setIsConfigured(true);
                if (parsed.clickUpListId) setListId(parsed.clickUpListId);
                fetchLists(parsed.clickUpToken);
            }
        } else {
            setIsConfigured(false);
        }
    }
  }, [isOpen]); 

  // Separate effect for AI generation that triggers on open OR mode change
  useEffect(() => {
    if (isOpen && slides.length > 0) {
        generateAIContent();
    }
  }, [isOpen, mode, activeSlideId]);

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

  const handleRefreshLists = () => {
      const globalConfig = localStorage.getItem('bugsnap_config');
      if (globalConfig) {
          const parsed = JSON.parse(globalConfig);
          if (parsed.clickUpToken) {
              fetchLists(parsed.clickUpToken);
          }
      }
  };

  const generateAIContent = async () => {
      setIsGeneratingAI(true);
      try {
          // Determine context based on mode
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

  const handleEnableDriveBackup = async () => {
      setIsAuthorizingDrive(true);
      try {
          const token = await requestDriveToken();
          const saved = localStorage.getItem('bugsnap_config');
          const config = saved ? JSON.parse(saved) : {};
          config.googleDriveToken = token;
          localStorage.setItem('bugsnap_config', JSON.stringify(config));
          
          // Retry export immediately
          handleExport();
      } catch (e) {
          console.error("Drive Auth Failed", e);
      } finally {
          setIsAuthorizingDrive(false);
      }
  };

  if (!isOpen) return null;

  // Not Configured State
  if (!isConfigured) {
      return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#272727] flex flex-col transition-colors">
                <div className="p-6 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-[#7B68EE]/10 dark:bg-[#7B68EE]/20 text-[#7B68EE] rounded-2xl flex items-center justify-center mb-4">
                        <Layers size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Connect ClickUp</h2>
                    <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">
                        You need to connect your ClickUp account before exporting tasks. It only takes a few seconds.
                    </p>
                    <button 
                        onClick={onConfigure}
                        className="w-full py-3 bg-[#7B68EE] hover:bg-[#6c5ce7] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
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
  const isStorageFullError = error?.includes('Storage Full') && !error?.includes('accessNotConfigured');
  const isDriveApiDisabled = error?.includes('accessNotConfigured') || error?.includes('Google Drive API has not been used');
  
  // Extract a cleaner error message for generic display
  const cleanError = error?.replace(/ClickUp API Error: \d+ - /, '').replace(/Error: /, '');

  const handleExport = () => {
      if (!listId) return;
      
      // Save the used List ID as preference
      const globalConfig = localStorage.getItem('bugsnap_config');
      if (globalConfig) {
         const parsed = JSON.parse(globalConfig);
         parsed.clickUpListId = listId;
         const listObj = availableLists.find(l => l.id === listId);
         if (listObj) parsed.clickUpListName = listObj.name;
         
         localStorage.setItem('bugsnap_config', JSON.stringify(parsed));
      }

      onExport(mode, listId, title, description);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-[#272727] flex flex-col max-h-[90vh] transition-colors">
        
        {/* Header */}
        <div className="bg-white dark:bg-[#1e1e1e] border-b border-slate-100 dark:border-[#272727] p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#7B68EE] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#7B68EE]/20">
               <Layers size={22} />
            </div>
            <div>
               <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Export to ClickUp</h2>
               <p className="text-xs text-slate-500 dark:text-zinc-400">Create tasks directly from your session</p>
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
                        The browser security proxy (cors-anywhere) requires a one-time verification.
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
                        <button 
                            onClick={handleExport}
                            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-xs"
                        >
                            <RefreshCw size={14} /> Retry
                        </button>
                    </div>
                 </div>
              ) : isDriveApiDisabled ? (
                 <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-2 font-bold text-amber-700 dark:text-amber-400">
                        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                        <span>Google Drive API Not Enabled</span>
                    </div>
                    <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                        The backup to Google Drive failed because the <strong>Google Drive API</strong> is not enabled for this project.
                    </p>
                    <div className="mt-1 flex gap-3">
                        <a 
                            href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=1070648127842" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-100 px-4 py-2 rounded-lg font-medium transition-colors text-xs border border-amber-200 dark:border-amber-800"
                        >
                            <ExternalLink size={14} /> Enable Drive API
                        </a>
                        <button 
                            onClick={handleExport}
                            className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-xs"
                        >
                            <RefreshCw size={14} /> Retry
                        </button>
                    </div>
                 </div>
              ) : isStorageFullError ? (
                 <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-2 font-bold text-red-800 dark:text-red-300">
                        <HardDrive size={16} className="mt-0.5 shrink-0" />
                        <span>ClickUp Storage Full</span>
                    </div>
                    <p className="text-red-700 dark:text-red-400">
                        Your ClickUp workspace has reached its storage limit. Enable Google Drive Backup to upload images to Drive and link them in the task instead.
                    </p>
                    <button 
                        onClick={handleEnableDriveBackup}
                        disabled={isAuthorizingDrive}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-xs w-fit"
                    >
                        {isAuthorizingDrive ? <Loader2 size={14} className="animate-spin"/> : <HardDrive size={14} />}
                        Enable Drive Backup & Retry
                    </button>
                 </div>
              ) : (
                 <div className="flex flex-col gap-1 text-red-700 dark:text-red-400 break-words">
                    <div className="flex items-start gap-2 font-bold">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>Export Failed</span>
                    </div>
                    <span className="pl-6 opacity-90 max-h-40 overflow-y-auto text-xs font-mono bg-red-50 dark:bg-black/20 p-2 rounded mt-1">
                        {cleanError || error}
                    </span>
                 </div>
              )}
            </div>
          )}

          {!isCorsDemoError && !isDriveApiDisabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                
                {/* Left Column: AI Smart Details */}
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2 text-[#7B68EE]">
                            <Sparkles size={18} />
                            <span className="text-sm font-bold uppercase tracking-wide">Smart Task Details</span>
                         </div>
                         <button 
                            onClick={generateAIContent}
                            disabled={isGeneratingAI}
                            className="text-xs flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 hover:text-[#7B68EE] dark:hover:text-[#9d8ef0] font-medium transition-colors bg-slate-50 dark:bg-[#272727] px-2 py-1 rounded-md"
                         >
                            <RefreshCw size={12} className={isGeneratingAI ? "animate-spin" : ""} />
                            Regenerate AI
                         </button>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-[#121212] p-1 rounded-2xl border border-slate-200 dark:border-[#3f3f3f] flex-1 flex flex-col">
                        <div className="p-4 space-y-4 flex-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Task Title</label>
                                <div className="relative group">
                                    <input 
                                        type="text" 
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#3f3f3f] text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#7B68EE] focus:border-transparent outline-none placeholder-slate-300 transition-all shadow-sm group-hover:border-slate-300 dark:group-hover:border-[#555]"
                                        placeholder="Generating title..."
                                        disabled={isGeneratingAI}
                                    />
                                    {isGeneratingAI && <div className="absolute right-3 top-3.5"><Loader2 size={16} className="animate-spin text-[#7B68EE]"/></div>}
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col">
                                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Description</label>
                                <div className="relative flex-1 group">
                                    <textarea 
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full h-full min-h-[200px] bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#3f3f3f] text-slate-800 dark:text-zinc-200 rounded-xl p-4 text-sm leading-relaxed focus:ring-2 focus:ring-[#7B68EE] focus:border-transparent outline-none placeholder-slate-300 transition-all shadow-sm resize-none group-hover:border-slate-300 dark:group-hover:border-[#555]"
                                        placeholder="Generating detailed description..."
                                        disabled={isGeneratingAI}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Settings & Destination */}
                <div className="flex flex-col gap-6">
                    
                    {/* Destination List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                                <List size={16} className="text-slate-400"/> Destination List
                            </label>
                            <button 
                                onClick={handleRefreshLists}
                                disabled={isLoadingLists}
                                className="p-1.5 text-slate-400 hover:text-[#7B68EE] hover:bg-slate-100 dark:hover:bg-[#272727] rounded-lg transition-colors"
                                title="Refresh Lists"
                            >
                                <RefreshCw size={14} className={isLoadingLists ? "animate-spin" : ""} />
                            </button>
                        </div>
                        <div className="relative">
                            <select
                                className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-xl shadow-sm focus:ring-2 focus:ring-[#7B68EE] focus:border-transparent p-3.5 pl-4 pr-10 text-sm font-medium appearance-none text-slate-700 dark:text-zinc-200 outline-none transition-colors cursor-pointer hover:border-[#7B68EE] dark:hover:border-[#7B68EE]"
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
                            <div className="absolute right-4 top-4 text-slate-400 dark:text-zinc-500 pointer-events-none flex items-center gap-2">
                                {isLoadingLists ? <Loader2 size={16} className="animate-spin text-[#7B68EE]" /> : <div className="border-l border-slate-200 dark:border-[#3f3f3f] pl-3 text-xs font-bold text-slate-300">▼</div>}
                            </div>
                        </div>
                    </div>

                    {/* Export Mode Cards */}
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                            <FileStack size={16} className="text-slate-400"/> Export Mode
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {/* Card 1: Current Slide */}
                            <div 
                                onClick={() => setMode('current')}
                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative group ${mode === 'current' ? 'border-[#7B68EE] bg-[#7B68EE]/5 dark:bg-[#7B68EE]/10 shadow-md' : 'border-slate-100 dark:border-[#272727] bg-white dark:bg-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#444]'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${mode === 'current' ? 'bg-[#7B68EE] text-white' : 'bg-slate-100 dark:bg-[#272727] text-slate-400'}`}>
                                        <ImageIcon size={18} />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-sm mb-1 ${mode === 'current' ? 'text-[#7B68EE]' : 'text-slate-700 dark:text-zinc-200'}`}>Current Slide Only</h4>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                                            Creates a single task for the active screenshot. Best for quick, one-off bug reports.
                                        </p>
                                    </div>
                                    {mode === 'current' && <div className="absolute top-4 right-4 text-[#7B68EE]"><Check size={18} strokeWidth={3} /></div>}
                                </div>
                            </div>

                            {/* Card 2: All Attachments */}
                            <div 
                                onClick={() => setMode('all_attachments')}
                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative group ${mode === 'all_attachments' ? 'border-[#7B68EE] bg-[#7B68EE]/5 dark:bg-[#7B68EE]/10 shadow-md' : 'border-slate-100 dark:border-[#272727] bg-white dark:bg-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#444]'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${mode === 'all_attachments' ? 'bg-[#7B68EE] text-white' : 'bg-slate-100 dark:bg-[#272727] text-slate-400'}`}>
                                        <FileStack size={18} />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-sm mb-1 ${mode === 'all_attachments' ? 'text-[#7B68EE]' : 'text-slate-700 dark:text-zinc-200'}`}>All Slides (One Task)</h4>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                                            Creates <strong>one master task</strong> and attaches all {slides.length} screenshots to it. Best for grouped evidence.
                                        </p>
                                    </div>
                                    {mode === 'all_attachments' && <div className="absolute top-4 right-4 text-[#7B68EE]"><Check size={18} strokeWidth={3} /></div>}
                                </div>
                            </div>

                            {/* Card 3: Subtasks */}
                            <div 
                                onClick={() => setMode('all_subtasks')}
                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative group ${mode === 'all_subtasks' ? 'border-[#7B68EE] bg-[#7B68EE]/5 dark:bg-[#7B68EE]/10 shadow-md' : 'border-slate-100 dark:border-[#272727] bg-white dark:bg-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#444]'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${mode === 'all_subtasks' ? 'bg-[#7B68EE] text-white' : 'bg-slate-100 dark:bg-[#272727] text-slate-400'}`}>
                                        <ListTree size={18} />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-sm mb-1 ${mode === 'all_subtasks' ? 'text-[#7B68EE]' : 'text-slate-700 dark:text-zinc-200'}`}>All Slides (Subtasks)</h4>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                                            Creates a parent task, then creates <strong>individual subtasks</strong> for each slide. Best for complex workflows.
                                        </p>
                                    </div>
                                    {mode === 'all_subtasks' && <div className="absolute top-4 right-4 text-[#7B68EE]"><Check size={18} strokeWidth={3} /></div>}
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
            disabled={loading || isAuthorizingDrive}
            className="px-6 py-2.5 text-slate-600 dark:text-zinc-400 font-bold hover:bg-slate-200 dark:hover:bg-[#272727] rounded-xl transition text-sm"
          >
            Cancel
          </button>
          
          {!isCorsDemoError && !isDriveApiDisabled && (
             <button 
               onClick={handleExport}
               disabled={loading || !listId || isGeneratingAI || isAuthorizingDrive}
               className="px-8 py-2.5 bg-[#7B68EE] hover:bg-[#6c5ce7] text-white font-bold rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-95"
             >
               {loading ? (
                 <>
                   <Loader2 size={18} className="animate-spin" />
                   Creating Task...
                 </>
               ) : (
                 <>
                   <UploadCloud size={18} />
                   Export to ClickUp
                 </>
               )}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};
