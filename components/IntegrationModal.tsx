
import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Save, Layers, Slack, CreditCard, Lock, Hash, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { IntegrationConfig, IntegrationSource } from '../types';
import { extractChannelId } from '../services/slackService';
import { validateClickUpToken } from '../services/clickUpService';

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: IntegrationSource | null;
  currentConfig: IntegrationConfig;
  onSave: (config: IntegrationConfig) => void;
}

export const IntegrationModal: React.FC<IntegrationModalProps> = ({
  isOpen,
  onClose,
  source,
  currentConfig,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<IntegrationConfig>>({});
  const [error, setError] = useState<string | null>(null);
  const [isCorsDemoError, setIsCorsDemoError] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  useEffect(() => {
    if (isOpen && source) {
      setFormData(currentConfig);
      setError(null);
      setIsCorsDemoError(false);
      setIsValidating(false);
    }
  }, [isOpen, source, currentConfig]);

  if (!isOpen || !source) return null;

  const handleChange = (key: keyof IntegrationConfig, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setError(null);
    setIsCorsDemoError(false);
  };

  const handleSave = async () => {
    let newConfig = { ...formData };
    
    // Trim string values to handle copy-paste errors
    if (newConfig.clickUpToken) newConfig.clickUpToken = newConfig.clickUpToken.trim();
    if (newConfig.slackToken) newConfig.slackToken = newConfig.slackToken.trim();
    if (newConfig.slackChannel) newConfig.slackChannel = newConfig.slackChannel.trim();

    setIsValidating(true);
    setError(null);
    setIsCorsDemoError(false);

    try {
        if (source === 'ClickUp') {
            if (!newConfig.clickUpToken) {
                throw new Error("Personal Access Token is required.");
            }
            
            // Validate Token
            const isValid = await validateClickUpToken(newConfig.clickUpToken);
            if (!isValid) {
                throw new Error("Invalid Personal Access Token. Authentication failed.");
            }

            // List selection handled elsewhere
        } 
        else if (source === 'Slack') {
            if (!newConfig.slackToken || !newConfig.slackToken.startsWith('xoxb-')) {
                throw new Error("Invalid Bot Token. It must start with 'xoxb-'.");
            }
            if (!newConfig.slackChannel) {
                throw new Error("Channel ID is required.");
            }
            const extractedId = extractChannelId(newConfig.slackChannel);
            if (!extractedId) {
                 throw new Error("Invalid Slack Channel ID.");
            }
            newConfig.slackChannel = extractedId;
        }
        else if (source === 'Jira') {
            if (!newConfig.jiraUrl || !newConfig.jiraToken || !newConfig.jiraEmail) {
                 throw new Error("All fields are required for Jira.");
            }
        }

        setIsValidating(false);
        onSave(newConfig as IntegrationConfig);
        onClose();

    } catch (err: any) {
        setIsValidating(false);
        if (err.message === 'corsdemo_required') {
            setIsCorsDemoError(true);
            setError("Browser Proxy requires one-time activation.");
        } else {
            setError(err.message || "Validation failed");
        }
    }
  };

  const handleDisconnect = () => {
      let newConfig = { ...formData };
      
      if (source === 'ClickUp') {
          newConfig.clickUpToken = undefined;
          newConfig.clickUpListId = undefined;
          newConfig.clickUpListName = undefined;
      } else if (source === 'Slack') {
          newConfig.slackToken = undefined;
          newConfig.slackChannel = undefined;
      }
      
      onSave(newConfig as IntegrationConfig);
      onClose();
  };

  // Render content based on source
  const renderContent = () => {
    switch(source) {
        case 'ClickUp':
            return (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Personal Access Token</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#7B68EE] focus:border-transparent p-3 pr-10 font-mono text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                placeholder="pk_123456_..."
                                value={formData.clickUpToken || ''}
                                onChange={(e) => handleChange('clickUpToken', e.target.value)}
                            />
                            <Lock className="absolute right-3 top-3.5 text-slate-400 dark:text-zinc-500" size={16} />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                           List selection is now available directly on the Dashboard and Export screen.
                        </p>
                    </div>
                </div>
            );
        case 'Slack':
            return (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Bot User OAuth Token (xoxb-...)</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#4A154B] focus:border-transparent p-3 pr-10 font-mono text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                placeholder="xoxb-..."
                                value={formData.slackToken || ''}
                                onChange={(e) => handleChange('slackToken', e.target.value)}
                            />
                            <Lock className="absolute right-3 top-3.5 text-slate-400 dark:text-zinc-500" size={16} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Channel ID</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#4A154B] focus:border-transparent p-3 pr-10 text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                placeholder="C12345678"
                                value={formData.slackChannel || ''}
                                onChange={(e) => handleChange('slackChannel', e.target.value)}
                            />
                            <Hash className="absolute right-3 top-3.5 text-slate-400 dark:text-zinc-500" size={16} />
                        </div>
                    </div>
                </div>
            );
        case 'Jira':
            return (
                 <div className="space-y-4">
                     <p className="text-sm text-slate-500 dark:text-zinc-400 italic">Jira integration coming soon. Configuration is currently unavailable.</p>
                 </div>
            );
        default:
            return null;
    }
  };

  const getColor = () => {
    switch(source) {
        case 'ClickUp': return '#7B68EE';
        case 'Slack': return '#4A154B';
        case 'Jira': return '#0052CC';
        default: return '#3b82f6';
    }
  };

  const getIcon = () => {
    switch(source) {
        case 'ClickUp': return <Layers size={20} />;
        case 'Slack': return <Slack size={20} />;
        case 'Jira': return <CreditCard size={20} />;
        default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in p-4">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#272727] transition-colors">
        <div className="p-4 flex items-center justify-between text-white" style={{ backgroundColor: getColor() }}>
           <div className="flex items-center gap-2 font-bold text-lg">
             {getIcon()}
             <span>Connect {source}</span>
           </div>
           <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition">
             <X size={20} />
           </button>
        </div>

        <div className="p-6">
            {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                    {isCorsDemoError && (
                         <a 
                            href="https://cors-anywhere.herokuapp.com/corsdemo" 
                            target="_blank" 
                            rel="noreferrer"
                            className="ml-6 text-xs underline font-bold hover:text-red-800 dark:hover:text-red-200 flex items-center gap-1"
                         >
                            <ExternalLink size={12} /> Click here to Unlock Proxy
                         </a>
                    )}
                </div>
            )}
            
            {renderContent()}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-[#272727] bg-slate-50 dark:bg-[#0f0f0f] flex justify-between gap-3">
           <button 
             onClick={handleDisconnect} 
             className="px-4 py-2 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-sm flex items-center gap-2"
           >
             <Trash2 size={16} /> Disconnect
           </button>
           
           <div className="flex gap-2">
               <button onClick={onClose} disabled={isValidating} className="px-4 py-2 text-slate-600 dark:text-zinc-300 font-medium hover:bg-slate-200 dark:hover:bg-[#272727] rounded-lg transition text-sm">
                 Cancel
               </button>
               <button 
                 onClick={handleSave}
                 disabled={isValidating}
                 className="px-6 py-2 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2 text-sm disabled:opacity-70"
                 style={{ backgroundColor: getColor() }}
               >
                 {isValidating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                 Save Credentials
               </button>
           </div>
        </div>
      </div>
    </div>
  );
};
