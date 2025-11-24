
import React, { useState, useEffect } from 'react';
import { IntegrationConfig } from '../types';
import { useToast } from './ToastProvider';
import { Save, Lock, List, CheckCircle2, AlertCircle, Slack, Hash, Layers } from 'lucide-react';
import { extractListId } from '../services/clickUpService';
import { extractChannelId } from '../services/slackService';

export const IntegrationsSettings: React.FC = () => {
  const [config, setConfig] = useState<IntegrationConfig>({});
  const [isSaved, setIsSaved] = useState(false);
  const [listIdError, setListIdError] = useState<string | null>(null);
  const [channelIdError, setChannelIdError] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('bugsnap_config');
    if (saved) {
      setConfig(JSON.parse(saved));
    }
  }, []);

  const handleChange = (key: keyof IntegrationConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setIsSaved(false);

    if (key === 'clickUpListId') {
      validateListId(value);
    }
    if (key === 'slackChannel') {
      validateChannelId(value);
    }
  };

  const validateListId = (val: string) => {
    if (!val) {
        setListIdError(null);
        return;
    }
    const extracted = extractListId(val);
    if (extracted) {
        setListIdError(null);
    } else {
        setListIdError("Invalid List URL or ID. Please navigate to the List in ClickUp and copy the URL.");
    }
  }

  const validateChannelId = (val: string) => {
    if (!val) {
        setChannelIdError(null);
        return;
    }
    const extracted = extractChannelId(val);
    if (extracted) {
        setChannelIdError(null);
    } else {
        setChannelIdError("Invalid Channel ID. It usually looks like 'C12345'.");
    }
  }

  const handleSave = () => {
    let finalConfig = { ...config };
    
    // Trim keys and IDs to prevent errors
    if (finalConfig.clickUpToken) finalConfig.clickUpToken = finalConfig.clickUpToken.trim();
    if (finalConfig.slackToken) finalConfig.slackToken = finalConfig.slackToken.trim();
    if (finalConfig.slackChannel) finalConfig.slackChannel = finalConfig.slackChannel.trim();

    // Clean up ClickUp List ID
    if (finalConfig.clickUpListId) {
        const extracted = extractListId(finalConfig.clickUpListId);
        if (extracted) finalConfig.clickUpListId = extracted;
    }

    // Clean up Slack Channel ID
    if (finalConfig.slackChannel) {
        const extracted = extractChannelId(finalConfig.slackChannel);
        if (extracted) finalConfig.slackChannel = extracted;
    }

    setConfig(finalConfig);
    localStorage.setItem('bugsnap_config', JSON.stringify(finalConfig));
    setIsSaved(true);
    addToast('Settings saved successfully', 'success');
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto h-full overflow-y-auto">
      <header className="mb-8 border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-bold text-slate-900">Integrations Hub</h1>
        <p className="text-slate-500 mt-1">Manage your connections to external tools. Keys are stored locally in your browser.</p>
      </header>

      <div className="space-y-8 pb-20">
        {/* ClickUp Config */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-[#7B68EE]">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-[#7B68EE] rounded-lg flex items-center justify-center text-white font-bold text-lg">
                <Layers size={20} />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-900">ClickUp Integration</h2>
                <p className="text-sm text-slate-500">Export reports as Tasks directly to your Lists.</p>
             </div>
          </div>
          
          <div className="grid gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Personal Access Token (pk_...)</label>
              <div className="relative">
                <input 
                  type="password" 
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-[#7B68EE] focus:ring-[#7B68EE] p-3 border pr-10 font-mono text-sm"
                  placeholder="pk_123456_..."
                  value={config.clickUpToken || ''}
                  onChange={(e) => handleChange('clickUpToken', e.target.value)}
                />
                <Lock className="absolute right-3 top-3.5 text-slate-400" size={16} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">List URL or ID</label>
              <div className="relative">
                <input 
                  type="text" 
                  className={`w-full border rounded-lg shadow-sm p-3 border pr-10 text-sm ${listIdError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-[#7B68EE] focus:ring-[#7B68EE]'}`}
                  placeholder="https://app.clickup.com/1234/v/li/90150..."
                  value={config.clickUpListId || ''}
                  onChange={(e) => handleChange('clickUpListId', e.target.value)}
                />
                <List className="absolute right-3 top-3.5 text-slate-400" size={16} />
              </div>
              {listIdError && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {listIdError}
                  </p>
              )}
              {!listIdError && config.clickUpListId && extractListId(config.clickUpListId) && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Valid List ID detected: {extractListId(config.clickUpListId)}
                  </p>
              )}
            </div>
          </div>
        </section>

        {/* Slack Config */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-[#4A154B]">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-[#4A154B] rounded-lg flex items-center justify-center text-white font-bold text-lg">
                <Slack size={20} />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-900">Slack Integration</h2>
                <p className="text-sm text-slate-500">Share reports and dashboard updates to a channel.</p>
             </div>
          </div>
          
          <div className="grid gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Bot User OAuth Token (xoxb-...)</label>
              <div className="relative">
                <input 
                  type="password" 
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-[#4A154B] focus:ring-[#4A154B] p-3 border pr-10 font-mono text-sm"
                  placeholder="xoxb-123456-..."
                  value={config.slackToken || ''}
                  onChange={(e) => handleChange('slackToken', e.target.value)}
                />
                <Lock className="absolute right-3 top-3.5 text-slate-400" size={16} />
              </div>
              <p className="text-xs text-slate-500 mt-1">Create an App at api.slack.com. Scopes: chat:write, files:write, channels:history.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Channel ID</label>
              <div className="relative">
                <input 
                  type="text" 
                  className={`w-full border rounded-lg shadow-sm p-3 border pr-10 text-sm ${channelIdError ? 'border-red-300 focus:border-red-500' : 'border-slate-300 focus:border-[#4A154B]'}`}
                  placeholder="C12345678"
                  value={config.slackChannel || ''}
                  onChange={(e) => handleChange('slackChannel', e.target.value)}
                />
                <Hash className="absolute right-3 top-3.5 text-slate-400" size={16} />
              </div>
               {channelIdError && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {channelIdError}
                  </p>
              )}
              <p className="text-xs text-slate-500 mt-1">Right-click a channel sidebar &gt; Copy Link. Paste to extract ID.</p>
            </div>
          </div>
        </section>

        {/* Jira Config (Placeholder) */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-[#0052CC] opacity-70">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-[#0052CC] rounded-lg flex items-center justify-center text-white font-bold text-lg">J</div>
             <div>
                <h2 className="text-xl font-bold text-slate-900">Jira Integration</h2>
                <p className="text-sm text-slate-500">Sync issues with Jira Software projects (Coming Soon).</p>
             </div>
          </div>
          <div className="grid gap-5">
             {/* Existing Jira Inputs */}
             <p className="text-sm italic text-slate-500">Jira configuration is currently read-only.</p>
          </div>
        </section>

        {/* Actions */}
        <div className="flex justify-end pt-4 fixed bottom-0 right-0 w-full bg-white border-t border-slate-200 p-4 z-10">
            <div className="max-w-3xl w-full mx-auto flex justify-end">
                <button 
                    onClick={handleSave}
                    className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white transition-all shadow-lg ${isSaved ? 'bg-green-600 transform scale-105' : 'bg-slate-900 hover:bg-slate-800'}`}
                >
                    {isSaved ? <span className="flex items-center gap-2"><CheckCircle2 size={20} /> Settings Saved</span> : <span className="flex items-center gap-2"><Save size={20} /> Save Changes</span>}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
