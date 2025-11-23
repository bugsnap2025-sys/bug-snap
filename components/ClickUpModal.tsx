import React, { useState, useEffect } from 'react';
import { ClickUpExportMode, Slide } from '../types';
import { Layers, UploadCloud, CheckCircle, AlertCircle, X, ExternalLink, RefreshCw, List } from 'lucide-react';
import { extractListId } from '../services/clickUpService';

interface ClickUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (mode: ClickUpExportMode, listId: string) => void;
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
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load last used List ID or from global config
  useEffect(() => {
    if (isOpen) {
        const savedListId = localStorage.getItem('bugsnap_last_clickup_list');
        const globalConfig = localStorage.getItem('bugsnap_config');
        
        if (savedListId) {
            setListId(savedListId);
        } else if (globalConfig) {
            const parsed = JSON.parse(globalConfig);
            if (parsed.clickUpListId) setListId(parsed.clickUpListId);
        }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCorsDemoError = error?.includes('corsdemo');
  const cleanError = error?.replace(/ClickUp API Error: \d+ - /, '');

  const handleExport = () => {
      setValidationError(null);
      if (!listId) {
          setValidationError("List URL or ID is required.");
          return;
      }
      const extracted = extractListId(listId);
      if (!extracted) {
          setValidationError("Invalid List URL or ID.");
          return;
      }
      
      // Save for next time
      localStorage.setItem('bugsnap_last_clickup_list', extracted);
      
      onExport(mode, extracted);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#7B68EE] p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Layers size={20} />
            <span>Export to ClickUp</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
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
            <>
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Destination List</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            className={`w-full border rounded-lg shadow-sm p-3 border pr-10 text-sm ${validationError ? 'border-red-300 focus:border-red-500 ring-red-200' : 'border-slate-300 focus:border-[#7B68EE] focus:ring-[#7B68EE]'}`}
                            placeholder="Paste List URL (https://app.clickup.com/...)"
                            value={listId}
                            onChange={(e) => {
                                setListId(e.target.value);
                                setValidationError(null);
                            }}
                        />
                        <List className="absolute right-3 top-3.5 text-slate-400" size={16} />
                    </div>
                    {validationError && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle size={12} /> {validationError}
                        </p>
                    )}
                </div>

                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Select Export Mode</h3>
                <div className="space-y-3">
                    {/* Option 1: Current Slide */}
                    <div 
                    onClick={() => setMode('current')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${mode === 'current' ? 'border-[#7B68EE] bg-[#7B68EE]/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                    <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${mode === 'current' ? 'border-[#7B68EE] bg-[#7B68EE]' : 'border-slate-300'}`}>
                        {mode === 'current' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">Current Slide Only</h4>
                        <p className="text-xs text-slate-500 mt-1">Creates a single task for the active slide and attaches the annotated image.</p>
                    </div>
                    </div>

                    {/* Option 2: All Slides (Attachments) */}
                    <div 
                    onClick={() => setMode('all_attachments')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${mode === 'all_attachments' ? 'border-[#7B68EE] bg-[#7B68EE]/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                    <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${mode === 'all_attachments' ? 'border-[#7B68EE] bg-[#7B68EE]' : 'border-slate-300'}`}>
                        {mode === 'all_attachments' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">All Slides (Single Task)</h4>
                        <p className="text-xs text-slate-500 mt-1">Creates one parent task and uploads all {slides.length} slides as attachments.</p>
                    </div>
                    </div>

                    {/* Option 3: Subtasks */}
                    <div 
                    onClick={() => setMode('all_subtasks')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${mode === 'all_subtasks' ? 'border-[#7B68EE] bg-[#7B68EE]/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                    <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${mode === 'all_subtasks' ? 'border-[#7B68EE] bg-[#7B68EE]' : 'border-slate-300'}`}>
                        {mode === 'all_subtasks' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">All Slides (Subtasks)</h4>
                        <p className="text-xs text-slate-500 mt-1">Creates a parent task, then creates individual subtasks for each slide to keep things organized.</p>
                    </div>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded text-xs text-slate-500">
                    <p className="flex items-start gap-1.5">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>Note: If you encounter network errors, please disable ad-blockers.</span>
                    </p>
                </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
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
               disabled={loading}
               className="px-6 py-2 bg-[#7B68EE] hover:bg-[#6c5ce7] text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2 text-sm disabled:opacity-70"
             >
               {loading ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   Sending...
                 </>
               ) : (
                 <>
                   <UploadCloud size={16} />
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