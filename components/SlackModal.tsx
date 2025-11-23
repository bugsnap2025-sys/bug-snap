
import React, { useState } from 'react';
import { SlackExportMode, Slide } from '../types';
import { Slack, UploadCloud, AlertCircle, X, ExternalLink, RefreshCw, MessageSquare, Images, ListTree } from 'lucide-react';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (mode: SlackExportMode) => void;
  loading: boolean;
  slides: Slide[];
  error?: string | null;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  onExport,
  loading,
  slides,
  error
}) => {
  const [mode, setMode] = useState<SlackExportMode>('current');

  if (!isOpen) return null;

  const isCorsDemoError = error?.includes('corsdemo');
  const cleanError = error?.replace(/Slack API Error: /, '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#4A154B] p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Slack size={20} />
            <span>Share to Slack</span>
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
                            onClick={() => onExport(mode)}
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
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Select Post Format</h3>
                <div className="space-y-3">
                    {/* Option 1: Current Slide */}
                    <div 
                    onClick={() => setMode('current')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${mode === 'current' ? 'border-[#4A154B] bg-[#4A154B]/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${mode === 'current' ? 'bg-[#4A154B] text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <MessageSquare size={16} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">Current Slide</h4>
                        <p className="text-xs text-slate-500 mt-1">Posts the active slide image and description as a single message.</p>
                    </div>
                    </div>

                    {/* Option 2: All Files */}
                    <div 
                    onClick={() => setMode('all_files')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${mode === 'all_files' ? 'border-[#4A154B] bg-[#4A154B]/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                     <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${mode === 'all_files' ? 'bg-[#4A154B] text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Images size={16} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">All Slides (Files)</h4>
                        <p className="text-xs text-slate-500 mt-1">Posts {slides.length} images as individual file uploads to the channel.</p>
                    </div>
                    </div>

                    {/* Option 3: Threaded */}
                    <div 
                    onClick={() => setMode('thread')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${mode === 'thread' ? 'border-[#4A154B] bg-[#4A154B]/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                     <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${mode === 'thread' ? 'bg-[#4A154B] text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <ListTree size={16} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">Threaded Report</h4>
                        <p className="text-xs text-slate-500 mt-1">Creates a parent message "Bug Report", then replies with each slide image.</p>
                    </div>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded text-xs text-slate-500">
                    <p className="flex items-start gap-1.5">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>Ensure the bot (@BugSnap) is invited to the channel.</span>
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
               onClick={() => onExport(mode)}
               disabled={loading}
               className="px-6 py-2 bg-[#4A154B] hover:bg-[#3f1240] text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2 text-sm disabled:opacity-70"
             >
               {loading ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   Posting...
                 </>
               ) : (
                 <>
                   <UploadCloud size={16} />
                   Share to Slack
                 </>
               )}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};
