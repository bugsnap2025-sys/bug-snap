
import React, { useState, useEffect } from 'react';
import { TeamsExportMode, Slide, IntegrationConfig } from '../types';
import { Users, UploadCloud, AlertCircle, X, ExternalLink, RefreshCw, MessageSquare, ListTree, ArrowRight, Zap } from 'lucide-react';

interface TeamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (mode: TeamsExportMode) => void;
  loading: boolean;
  slides: Slide[];
  error?: string | null;
  onConfigure?: () => void;
}

export const TeamsModal: React.FC<TeamsModalProps> = ({
  isOpen,
  onClose,
  onExport,
  loading,
  slides,
  error,
  onConfigure
}) => {
  const [mode, setMode] = useState<TeamsExportMode>('current');
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
      if (isOpen) {
          const globalConfig = localStorage.getItem('bugsnap_config');
          if (globalConfig) {
              const parsed: IntegrationConfig = JSON.parse(globalConfig);
              if (!parsed.teamsWebhookUrl) {
                  setIsConfigured(false);
              } else {
                  setIsConfigured(true);
              }
          } else {
              setIsConfigured(false);
          }
      }
  }, [isOpen]);

  if (!isOpen) return null;

  // Not Configured State
  if (!isConfigured) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#272727] transition-colors">
                <div className="p-6 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-[#5059C9]/10 dark:bg-[#5059C9]/20 text-[#5059C9] rounded-2xl flex items-center justify-center mb-4">
                        <Users size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Connect Microsoft Teams</h2>
                    <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">
                        Connect using an Incoming Webhook URL to share formatted bug reports directly to your channel.
                    </p>
                    <button 
                        onClick={onConfigure}
                        className="w-full py-3 bg-[#5059C9] hover:bg-[#434aa8] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#272727] transition-colors">
        {/* Header */}
        <div className="bg-[#5059C9] p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Users size={20} />
            <span>Share to Teams</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
              {isCorsDemoError ? (
                 <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2 text-red-800 dark:text-red-300 font-bold">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>Proxy Activation Required</span>
                    </div>
                    <p className="text-red-700 dark:text-red-400">
                        The browser security proxy requires one-time verification to reach the Webhook URL.
                    </p>
                    <div className="mt-2 space-y-2">
                        <a 
                            href="https://cors-anywhere.herokuapp.com/corsdemo" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-900 dark:text-red-100 py-2 rounded font-medium transition-colors"
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
                 <div className="flex flex-col gap-1 text-red-700 dark:text-red-400 break-words">
                    <div className="flex items-start gap-2 font-bold">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>Export Failed</span>
                    </div>
                    <span className="pl-6">{error}</span>
                 </div>
              )}
            </div>
          )}

          {!isCorsDemoError && (
            <>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Select Format</h3>
                <div className="space-y-3">
                    {/* Option 1: Current Slide */}
                    <div 
                    onClick={() => setMode('current')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${mode === 'current' ? 'border-[#5059C9] bg-[#5059C9]/5 dark:bg-[#5059C9]/20' : 'border-slate-100 dark:border-[#272727] hover:border-slate-200 dark:hover:border-[#3f3f3f]'}`}
                    >
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${mode === 'current' ? 'bg-[#5059C9] text-white' : 'bg-slate-100 dark:bg-[#272727] text-slate-400'}`}>
                        <MessageSquare size={16} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">Current Slide</h4>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Sends an Adaptive Card with the bug details for the active slide.</p>
                    </div>
                    </div>

                    {/* Option 2: Summary */}
                    <div 
                    onClick={() => setMode('summary')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${mode === 'summary' ? 'border-[#5059C9] bg-[#5059C9]/5 dark:bg-[#5059C9]/20' : 'border-slate-100 dark:border-[#272727] hover:border-slate-200 dark:hover:border-[#3f3f3f]'}`}
                    >
                     <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${mode === 'summary' ? 'bg-[#5059C9] text-white' : 'bg-slate-100 dark:bg-[#272727] text-slate-400'}`}>
                        <ListTree size={16} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">Full Report Summary</h4>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Sends a summary card of all {slides.length} slides and their issues.</p>
                    </div>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded text-xs text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                    <p className="flex items-start gap-1.5">
                    <Zap size={14} className="shrink-0 mt-0.5" />
                    <span>Note: Images are not attached to Webhook messages. The report contains detailed text descriptions.</span>
                    </p>
                </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-[#272727] bg-slate-50 dark:bg-[#0f0f0f] flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-slate-600 dark:text-zinc-400 font-medium hover:bg-slate-200 dark:hover:bg-[#272727] rounded-lg transition text-sm"
          >
            Cancel
          </button>
          
          {!isCorsDemoError && (
             <button 
               onClick={() => onExport(mode)}
               disabled={loading}
               className="px-6 py-2 bg-[#5059C9] hover:bg-[#434aa8] text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2 text-sm disabled:opacity-70"
             >
               {loading ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   Sending...
                 </>
               ) : (
                 <>
                   <UploadCloud size={16} />
                   Send to Teams
                 </>
               )}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};
