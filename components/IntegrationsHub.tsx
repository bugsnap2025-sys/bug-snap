
import React, { useState, useEffect } from 'react';
import { IntegrationConfig, IntegrationSource } from '../types';
import { useToast } from './ToastProvider';
import { Layers, Slack, CreditCard, CheckCircle2, ArrowRight, Zap, Trash2, Users, Webhook, HardDrive } from 'lucide-react';
import { IntegrationModal } from './IntegrationModal';

export const IntegrationsHub: React.FC = () => {
  const [config, setConfig] = useState<IntegrationConfig>({});
  const [activeModal, setActiveModal] = useState<IntegrationSource | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('bugsnap_config');
    if (saved) {
      setConfig(JSON.parse(saved));
    }
  }, []);

  const handleSaveConfig = (newConfig: IntegrationConfig) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    localStorage.setItem('bugsnap_config', JSON.stringify({ ...config, ...newConfig }));
    addToast(`${activeModal} connected successfully!`, 'success');
    setActiveModal(null);
  };

  const handleDisconnect = (source: IntegrationSource) => {
      const newConfig = { ...config };
      if (source === 'ClickUp') {
          newConfig.clickUpToken = undefined;
          newConfig.clickUpListId = undefined;
          newConfig.clickUpListName = undefined;
      } else if (source === 'Jira') {
          newConfig.jiraToken = undefined;
          newConfig.jiraUrl = undefined;
          newConfig.jiraEmail = undefined;
      } else if (source === 'Teams') {
          newConfig.teamsWebhookUrl = undefined;
          newConfig.teamsToken = undefined;
          newConfig.teamsTeamId = undefined;
          newConfig.teamsChannelId = undefined;
      } else if (source === 'Asana') {
          newConfig.asanaToken = undefined;
          newConfig.asanaWorkspaceId = undefined;
      } else if (source === 'Webhook') {
          newConfig.webhookUrl = undefined;
      } else if (source === 'GoogleDrive') {
          newConfig.googleDriveToken = undefined;
      }
      
      setConfig(newConfig);
      localStorage.setItem('bugsnap_config', JSON.stringify(newConfig));
      addToast(`${source} disconnected.`, 'info');
  };

  const isConnected = (source: IntegrationSource) => {
      switch(source) {
          case 'ClickUp': return !!config.clickUpToken; 
          case 'Slack': return !!config.slackToken && !!config.slackChannel;
          case 'Jira': return !!config.jiraToken && !!config.jiraUrl && !!config.jiraEmail;
          case 'Teams': return !!config.teamsWebhookUrl; // Updated check
          case 'Asana': return !!config.asanaToken;
          case 'Webhook': return !!config.webhookUrl;
          case 'GoogleDrive': return !!config.googleDriveToken;
      }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-[#0f0f0f] overflow-y-auto transition-colors">
      <IntegrationModal 
        isOpen={!!activeModal}
        source={activeModal}
        onClose={() => setActiveModal(null)}
        currentConfig={config}
        onSave={handleSaveConfig}
      />

      <div className="max-w-6xl mx-auto p-8">
        <header className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Integrations Hub</h1>
            <p className="text-slate-500 dark:text-zinc-400 text-lg">Connect your favorite tools to streamline bug reporting workflow.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ClickUp Card */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#272727] p-6 flex flex-col hover:border-[#7B68EE] dark:hover:border-[#7B68EE] transition-all group relative overflow-hidden">
                {isConnected('ClickUp') && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                        <CheckCircle2 size={12} /> CONNECTED
                    </div>
                )}
                <div className="w-14 h-14 bg-[#7B68EE]/10 dark:bg-[#7B68EE]/20 text-[#7B68EE] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Layers size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">ClickUp</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6 flex-1">Export annotated bug reports directly to your ClickUp Lists as tasks with attachments.</p>
                
                {isConnected('ClickUp') ? (
                    <button 
                        onClick={() => handleDisconnect('ClickUp')}
                        className="w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
                    >
                        <Trash2 size={16} /> Disconnect
                    </button>
                ) : (
                    <button 
                        onClick={() => setActiveModal('ClickUp')}
                        className="w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-[#7B68EE] text-white hover:bg-[#6c5ce7] shadow-md hover:shadow-lg"
                    >
                        Connect ClickUp <ArrowRight size={16} />
                    </button>
                )}
            </div>

            {/* Google Drive Card */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#272727] p-6 flex flex-col hover:border-blue-500 dark:hover:border-blue-500 transition-all group relative overflow-hidden">
                {isConnected('GoogleDrive') && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                        <CheckCircle2 size={12} /> CONNECTED
                    </div>
                )}
                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <HardDrive size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Google Drive</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6 flex-1">
                    Backup storage for when your issue tracker (like ClickUp) is full. Images are saved to Drive and linked in the task.
                </p>
                
                {isConnected('GoogleDrive') ? (
                    <button 
                        onClick={() => handleDisconnect('GoogleDrive')}
                        className="w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
                    >
                        <Trash2 size={16} /> Disconnect
                    </button>
                ) : (
                    <button 
                        onClick={() => setActiveModal('GoogleDrive')}
                        className="w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
                    >
                        Connect Drive <ArrowRight size={16} />
                    </button>
                )}
            </div>

            {/* Slack Card */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#272727] p-6 flex flex-col hover:border-[#4A154B] dark:hover:border-[#4A154B] transition-all group relative overflow-hidden">
                {isConnected('Slack') && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                        <CheckCircle2 size={12} /> CONNECTED
                    </div>
                )}
                <div className="w-14 h-14 bg-[#4A154B]/10 dark:bg-[#4A154B]/20 text-[#4A154B] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Slack size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Slack</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6 flex-1">Share daily dashboard summaries and instant bug alerts to your team channels.</p>
                <button 
                     onClick={() => setActiveModal('Slack')}
                     className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${isConnected('Slack') ? 'bg-slate-100 dark:bg-[#272727] text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-[#3f3f3f]' : 'bg-[#4A154B] text-white hover:bg-[#3f1240] shadow-md hover:shadow-lg'}`}
                >
                    {isConnected('Slack') ? 'Manage Connection' : 'Connect Slack'}
                    {!isConnected('Slack') && <ArrowRight size={16} />}
                </button>
            </div>

            {/* Jira Card */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#272727] p-6 flex flex-col hover:border-[#0052CC] dark:hover:border-[#0052CC] transition-all group relative overflow-hidden">
                {isConnected('Jira') && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                        <CheckCircle2 size={12} /> CONNECTED
                    </div>
                )}
                <div className="w-14 h-14 bg-[#0052CC]/10 dark:bg-[#0052CC]/20 text-[#0052CC] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <CreditCard size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Jira</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6 flex-1">Sync reported issues bi-directionally with your Jira Software backlog.</p>
                
                {isConnected('Jira') ? (
                     <button 
                        onClick={() => handleDisconnect('Jira')}
                        className="w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
                    >
                        <Trash2 size={16} /> Disconnect
                    </button>
                ) : (
                    <button 
                         onClick={() => setActiveModal('Jira')}
                         className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#0052CC] text-white hover:bg-[#0747A6] flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                    >
                        Connect Jira <ArrowRight size={16} />
                    </button>
                )}
            </div>

            {/* Microsoft Teams Card */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#272727] p-6 flex flex-col hover:border-[#5059C9] dark:hover:border-[#5059C9] transition-all group relative overflow-hidden">
                {isConnected('Teams') && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                        <CheckCircle2 size={12} /> CONNECTED
                    </div>
                )}
                <div className="w-14 h-14 bg-[#5059C9]/10 dark:bg-[#5059C9]/20 text-[#5059C9] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Users size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Microsoft Teams</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6 flex-1">Send formatted bug reports to channels via Incoming Webhooks.</p>
                
                {isConnected('Teams') ? (
                     <button 
                        onClick={() => handleDisconnect('Teams')}
                        className="w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
                    >
                        <Trash2 size={16} /> Disconnect
                    </button>
                ) : (
                    <button 
                         onClick={() => setActiveModal('Teams')}
                         className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#5059C9] text-white hover:bg-[#434aa8] flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                    >
                        Connect Teams <ArrowRight size={16} />
                    </button>
                )}
            </div>

            {/* Asana Card */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#272727] p-6 flex flex-col hover:border-[#F06A6A] dark:hover:border-[#F06A6A] transition-all group relative overflow-hidden">
                {isConnected('Asana') && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                        <CheckCircle2 size={12} /> CONNECTED
                    </div>
                )}
                <div className="w-14 h-14 bg-[#F06A6A]/10 dark:bg-[#F06A6A]/20 text-[#F06A6A] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Asana</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6 flex-1">Sync annotated bug reports to your Asana projects as tasks.</p>
                
                {isConnected('Asana') ? (
                     <button 
                        onClick={() => handleDisconnect('Asana')}
                        className="w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
                    >
                        <Trash2 size={16} /> Disconnect
                    </button>
                ) : (
                    <button 
                         onClick={() => setActiveModal('Asana')}
                         className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#F06A6A] text-white hover:bg-[#e05a5a] flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                    >
                        Connect Asana <ArrowRight size={16} />
                    </button>
                )}
            </div>

            {/* Webhook Card */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#272727] p-6 flex flex-col hover:border-pink-600 dark:hover:border-pink-600 transition-all group relative overflow-hidden">
                {isConnected('Webhook') && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                        <CheckCircle2 size={12} /> CONNECTED
                    </div>
                )}
                <div className="w-14 h-14 bg-pink-600/10 dark:bg-pink-600/20 text-pink-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Webhook size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Custom Webhook</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6 flex-1">Send bug reports to Zapier, Make, or any custom endpoint via JSON payload.</p>
                
                {isConnected('Webhook') ? (
                     <button 
                        onClick={() => handleDisconnect('Webhook')}
                        className="w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
                    >
                        <Trash2 size={16} /> Disconnect
                    </button>
                ) : (
                    <button 
                         onClick={() => setActiveModal('Webhook')}
                         className="w-full py-2.5 rounded-lg font-bold text-sm bg-pink-600 text-white hover:bg-pink-700 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                    >
                        Configure Webhook <ArrowRight size={16} />
                    </button>
                )}
            </div>
        </div>

        <div className="mt-12 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-6 flex items-start gap-4">
             <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                 <Zap size={24} />
             </div>
             <div>
                 <h3 className="font-bold text-slate-900 dark:text-white text-lg">Why connect integrations?</h3>
                 <p className="text-slate-600 dark:text-zinc-300 mt-1 max-w-2xl">
                     BugSnap works best when connected to your existing tools. Integrations allow you to 
                     push bug reports directly to your issue tracker without manual copy-pasting, and keep your 
                     team updated automatically.
                 </p>
             </div>
        </div>
      </div>
    </div>
  );
};
