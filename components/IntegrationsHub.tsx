import React, { useState, useEffect } from 'react';
import { IntegrationConfig, IntegrationSource } from '../types';
import { useToast } from './ToastProvider';
import { Layers, Slack, CreditCard, CheckCircle2, ArrowRight, Zap } from 'lucide-react';
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

  const isConnected = (source: IntegrationSource) => {
      switch(source) {
          case 'ClickUp': return !!config.clickUpToken && !!config.clickUpListId;
          case 'Slack': return !!config.slackToken && !!config.slackChannel;
          case 'Jira': return !!config.jiraToken && !!config.jiraUrl;
      }
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto">
      <IntegrationModal 
        isOpen={!!activeModal}
        source={activeModal}
        onClose={() => setActiveModal(null)}
        currentConfig={config}
        onSave={handleSaveConfig}
      />

      <div className="max-w-6xl mx-auto p-8">
        <header className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Integrations Hub</h1>
            <p className="text-slate-500 text-lg">Connect your favorite tools to streamline bug reporting workflow.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ClickUp Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:border-[#7B68EE] transition-all group relative overflow-hidden">
                {isConnected('ClickUp') && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                        <CheckCircle2 size={12} /> CONNECTED
                    </div>
                )}
                <div className="w-14 h-14 bg-[#7B68EE]/10 text-[#7B68EE] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Layers size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">ClickUp</h3>
                <p className="text-slate-500 text-sm mb-6 flex-1">Export annotated bug reports directly to your ClickUp Lists as tasks with attachments.</p>
                <button 
                    onClick={() => setActiveModal('ClickUp')}
                    className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${isConnected('ClickUp') ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-[#7B68EE] text-white hover:bg-[#6c5ce7] shadow-md hover:shadow-lg'}`}
                >
                    {isConnected('ClickUp') ? 'Manage Connection' : 'Connect ClickUp'}
                    {!isConnected('ClickUp') && <ArrowRight size={16} />}
                </button>
            </div>

            {/* Slack Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:border-[#4A154B] transition-all group relative overflow-hidden">
                {isConnected('Slack') && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                        <CheckCircle2 size={12} /> CONNECTED
                    </div>
                )}
                <div className="w-14 h-14 bg-[#4A154B]/10 text-[#4A154B] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Slack size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Slack</h3>
                <p className="text-slate-500 text-sm mb-6 flex-1">Share daily dashboard summaries and instant bug alerts to your team channels.</p>
                <button 
                     onClick={() => setActiveModal('Slack')}
                     className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${isConnected('Slack') ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-[#4A154B] text-white hover:bg-[#3f1240] shadow-md hover:shadow-lg'}`}
                >
                    {isConnected('Slack') ? 'Manage Connection' : 'Connect Slack'}
                    {!isConnected('Slack') && <ArrowRight size={16} />}
                </button>
            </div>

            {/* Jira Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:border-[#0052CC] transition-all group relative overflow-hidden opacity-80">
                 <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded border border-slate-200">
                        COMING SOON
                 </div>
                <div className="w-14 h-14 bg-[#0052CC]/10 text-[#0052CC] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <CreditCard size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Jira</h3>
                <p className="text-slate-500 text-sm mb-6 flex-1">Sync reported issues bi-directionally with your Jira Software backlog.</p>
                <button 
                     onClick={() => setActiveModal('Jira')}
                     className="w-full py-2.5 rounded-lg font-bold text-sm bg-slate-100 text-slate-400 cursor-not-allowed flex items-center justify-center gap-2"
                     disabled
                >
                    Connect Jira
                </button>
            </div>
        </div>

        <div className="mt-12 bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-start gap-4">
             <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                 <Zap size={24} />
             </div>
             <div>
                 <h3 className="font-bold text-slate-900 text-lg">Why connect integrations?</h3>
                 <p className="text-slate-600 mt-1 max-w-2xl">
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