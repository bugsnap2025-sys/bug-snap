import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Save, Layers, Slack, CreditCard, Lock, Hash } from 'lucide-react';
import { IntegrationConfig, IntegrationSource } from '../types';
import { extractChannelId } from '../services/slackService';

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
  
  useEffect(() => {
    if (isOpen && source) {
      setFormData(currentConfig);
      setError(null);
    }
  }, [isOpen, source, currentConfig]);

  if (!isOpen || !source) return null;

  const handleChange = (key: keyof IntegrationConfig, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSave = () => {
    let newConfig = { ...formData };
    
    if (source === 'ClickUp') {
        if (!newConfig.clickUpToken) {
            setError("Personal Access Token is required.");
            return;
        }
        // List selection is now handled in the Dashboard/Export modal
    } 
    else if (source === 'Slack') {
        if (!newConfig.slackToken || !newConfig.slackToken.startsWith('xoxb-')) {
            setError("Invalid Bot Token. It must start with 'xoxb-'.");
            return;
        }
        if (!newConfig.slackChannel) {
            setError("Channel ID is required.");
            return;
        }
        const extractedId = extractChannelId(newConfig.slackChannel);
        if (!extractedId) {
             setError("Invalid Slack Channel ID.");
             return;
        }
        newConfig.slackChannel = extractedId;
    }
    else if (source === 'Jira') {
        if (!newConfig.jiraUrl || !newConfig.jiraToken || !newConfig.jiraEmail) {
             setError("All fields are required for Jira.");
             return;
        }
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
                        <label className="block text-sm font-bold text-slate-700 mb-1">Personal Access Token</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full border-slate-300 rounded-lg shadow-sm focus:border-[#7B68EE] focus:ring-[#7B68EE] p-3 border pr-10 font-mono text-sm"
                                placeholder="pk_123456_..."
                                value={formData.clickUpToken || ''}
                                onChange={(e) => handleChange('clickUpToken', e.target.value)}
                            />
                            <Lock className="absolute right-3 top-3.5 text-slate-400" size={16} />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                           List selection is now available directly on the Dashboard and Export screen.
                        </p>
                    </div>
                </div>
            );
        case 'Slack':
            return (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Bot User OAuth Token (xoxb-...)</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full border-slate-300 rounded-lg shadow-sm focus:border-[#4A154B] focus:ring-[#4A154B] p-3 border pr-10 font-mono text-sm"
                                placeholder="xoxb-..."
                                value={formData.slackToken || ''}
                                onChange={(e) => handleChange('slackToken', e.target.value)}
                            />
                            <Lock className="absolute right-3 top-3.5 text-slate-400" size={16} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Channel ID</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full border-slate-300 rounded-lg shadow-sm focus:border-[#4A154B] focus:ring-[#4A154B] p-3 border pr-10 text-sm"
                                placeholder="C123456"
                                value={formData.slackChannel || ''}
                                onChange={(e) => handleChange('slackChannel', e.target.value)}
                            />
                            <Hash className="absolute right-3 top-3.5 text-slate-400" size={16} />
                        </div>
                    </div>
                </div>
            );
        case 'Jira':
            return (
                 <div className="space-y-4">
                     <p className="text-sm text-slate-500 italic">Jira integration coming soon. Configuration is currently unavailable.</p>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
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
                <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            
            {renderContent()}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition text-sm">
             Cancel
           </button>
           <button 
             onClick={handleSave}
             className="px-6 py-2 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2 text-sm"
             style={{ backgroundColor: getColor() }}
           >
             <Save size={16} /> Save Credentials
           </button>
        </div>
      </div>
    </div>
  );
};