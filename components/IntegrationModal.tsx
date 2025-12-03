
import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Save, Layers, Slack, CreditCard, Lock, Hash, Trash2, Loader2, ExternalLink, Globe, Mail, Users, Key, CheckCircle2, Link as LinkIcon, Webhook, HardDrive, Info, Trello } from 'lucide-react';
import { IntegrationConfig, IntegrationSource } from '../types';
import { extractChannelId } from '../services/slackService';
import { validateClickUpToken } from '../services/clickUpService';
import { validateJiraCredentials } from '../services/jiraService';
import { validateTeamsWebhookUrl } from '../services/teamsService';
import { validateAsanaToken } from '../services/asanaService';
import { validateTrelloCredentials } from '../services/trelloService';
import { validateWebhookUrl } from '../services/webhookService';
import { requestDriveToken } from '../services/googleDriveService';

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

  const handleJiraUrlBlur = () => {
      let url = formData.jiraUrl || '';
      if (!url) return;
      
      // Auto-fix protocol
      if (!url.match(/^https?:\/\//)) {
          url = 'https://' + url;
      }

      // Smart Fix: If user entered "xyz.atlassian" without ".net", append it.
      if (url.includes('.atlassian') && !url.includes('.atlassian.net')) {
          url = url.replace(/\.atlassian(\/|$)/, '.atlassian.net$1');
      }
      
      try {
          const urlObj = new URL(url);
          const cleanBase = `${urlObj.protocol}//${urlObj.hostname}`;
          if (cleanBase !== formData.jiraUrl) {
              handleChange('jiraUrl', cleanBase);
          }
      } catch (e) {
          // If invalid URL, leave as is for validation to catch
      }
  };

  const handleSave = async () => {
    let newConfig = { ...formData };
    
    // Trim string values
    if (newConfig.clickUpToken) newConfig.clickUpToken = newConfig.clickUpToken.trim();
    if (newConfig.slackToken) newConfig.slackToken = newConfig.slackToken.trim();
    if (newConfig.slackChannel) newConfig.slackChannel = newConfig.slackChannel.trim();
    if (newConfig.jiraUrl) newConfig.jiraUrl = newConfig.jiraUrl.trim().replace(/\/$/, '');
    if (newConfig.jiraEmail) newConfig.jiraEmail = newConfig.jiraEmail.trim();
    if (newConfig.jiraToken) newConfig.jiraToken = newConfig.jiraToken.trim();
    if (newConfig.teamsWebhookUrl) newConfig.teamsWebhookUrl = newConfig.teamsWebhookUrl.trim();
    if (newConfig.asanaToken) newConfig.asanaToken = newConfig.asanaToken.trim();
    if (newConfig.trelloApiKey) newConfig.trelloApiKey = newConfig.trelloApiKey.trim();
    if (newConfig.trelloToken) newConfig.trelloToken = newConfig.trelloToken.trim();
    if (newConfig.webhookUrl) newConfig.webhookUrl = newConfig.webhookUrl.trim();

    if (source === 'Jira' && newConfig.jiraUrl && newConfig.jiraUrl.includes('.atlassian') && !newConfig.jiraUrl.includes('.atlassian.net')) {
         newConfig.jiraUrl = newConfig.jiraUrl.replace('.atlassian', '.atlassian.net');
    }

    setIsValidating(true);
    setError(null);
    setIsCorsDemoError(false);

    try {
        if (source === 'ClickUp') {
            if (!newConfig.clickUpToken) {
                throw new Error("Personal Access Token is required.");
            }
            const isValid = await validateClickUpToken(newConfig.clickUpToken);
            if (!isValid) {
                throw new Error("Invalid Personal Access Token. Authentication failed.");
            }
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
            const isValid = await validateJiraCredentials(newConfig.jiraUrl, newConfig.jiraEmail, newConfig.jiraToken);
            if (!isValid) throw new Error("Jira Authentication Failed. Check credentials.");
        }
        else if (source === 'Teams') {
            if (!newConfig.teamsWebhookUrl) {
                throw new Error("Webhook URL is required.");
            }
            const isValid = await validateTeamsWebhookUrl(newConfig.teamsWebhookUrl);
            if (!isValid) throw new Error("Invalid Microsoft Teams Webhook URL.");
        }
        else if (source === 'Asana') {
            if (!newConfig.asanaToken) {
                throw new Error("Personal Access Token is required.");
            }
            const isValid = await validateAsanaToken(newConfig.asanaToken);
            if (!isValid) throw new Error("Asana Authentication Failed.");
        }
        else if (source === 'Trello') {
            if (!newConfig.trelloApiKey || !newConfig.trelloToken) {
                throw new Error("API Key and Token are required.");
            }
            const isValid = await validateTrelloCredentials(newConfig.trelloApiKey, newConfig.trelloToken);
            if (!isValid) throw new Error("Trello Authentication Failed.");
        }
        else if (source === 'Webhook') {
            if (!newConfig.webhookUrl) {
                throw new Error("Webhook URL is required.");
            }
            const isValid = await validateWebhookUrl(newConfig.webhookUrl);
            if (!isValid) throw new Error("Invalid URL format.");
        }
        else if (source === 'GoogleDrive') {
            if (!newConfig.googleDriveToken) {
                throw new Error("Please connect Google Drive first.");
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

  const handleConnectDrive = async () => {
      setIsValidating(true);
      try {
          const token = await requestDriveToken();
          setFormData(prev => ({ ...prev, googleDriveToken: token }));
          setIsValidating(false);
      } catch (e) {
          setIsValidating(false);
          setError("Failed to connect to Google Drive. Popup might be blocked.");
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
      } else if (source === 'Jira') {
          newConfig.jiraToken = undefined;
          newConfig.jiraEmail = undefined;
          newConfig.jiraUrl = undefined;
      } else if (source === 'Teams') {
          newConfig.teamsWebhookUrl = undefined;
          newConfig.teamsToken = undefined;
          newConfig.teamsTeamId = undefined;
          newConfig.teamsChannelId = undefined;
      } else if (source === 'Asana') {
          newConfig.asanaToken = undefined;
          newConfig.asanaWorkspaceId = undefined;
      } else if (source === 'Trello') {
          newConfig.trelloApiKey = undefined;
          newConfig.trelloToken = undefined;
      } else if (source === 'Webhook') {
          newConfig.webhookUrl = undefined;
      } else if (source === 'GoogleDrive') {
          newConfig.googleDriveToken = undefined;
      }
      
      onSave(newConfig as IntegrationConfig);
      onClose();
  };

  const getTrelloTokenUrl = () => {
      const apiKey = formData.trelloApiKey;
      if (!apiKey || apiKey.length < 10) return null;
      return `https://trello.com/1/authorize?expiration=never&name=BugSnap&scope=read,write&response_type=token&key=${apiKey}`;
  }

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
                            Generate a token in <a href="https://app.clickup.com/settings/apps" target="_blank" rel="noreferrer" className="text-[#7B68EE] hover:text-[#6c5ce7] underline font-medium">ClickUp Settings &gt; Apps</a>
                        </p>
                    </div>
                </div>
            );
        case 'Trello':
            return (
                <div className="space-y-5">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300">API Key</label>
                            <a href="https://trello.com/app-key" target="_blank" rel="noreferrer" className="text-xs text-[#0079BF] hover:underline font-bold flex items-center gap-1">
                                Get API Key <ExternalLink size={10} />
                            </a>
                        </div>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#0079BF] focus:border-transparent p-3 pr-10 font-mono text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                placeholder="Paste API Key"
                                value={formData.trelloApiKey || ''}
                                onChange={(e) => handleChange('trelloApiKey', e.target.value)}
                            />
                            <Key className="absolute right-3 top-3.5 text-slate-400 dark:text-zinc-500" size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300">Token</label>
                            {formData.trelloApiKey && (
                                <a href={getTrelloTokenUrl() || '#'} target="_blank" rel="noreferrer" className="text-xs text-[#0079BF] hover:underline font-bold flex items-center gap-1 animate-in fade-in">
                                    Generate Token <ExternalLink size={10} />
                                </a>
                            )}
                        </div>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#0079BF] focus:border-transparent p-3 pr-10 font-mono text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                placeholder="Paste Token"
                                value={formData.trelloToken || ''}
                                onChange={(e) => handleChange('trelloToken', e.target.value)}
                            />
                            <Lock className="absolute right-3 top-3.5 text-slate-400 dark:text-zinc-500" size={16} />
                        </div>
                        {!formData.trelloApiKey && (
                            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">Enter API Key first to generate a Token link.</p>
                        )}
                    </div>
                </div>
            );
        case 'GoogleDrive':
            return (
                <div className="space-y-6">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-3">
                            <HardDrive className="text-blue-600 dark:text-blue-400" size={24} />
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Google Drive Backup</h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">Use Drive when ClickUp storage is full.</p>
                            </div>
                        </div>
                        {formData.googleDriveToken ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold">
                                <CheckCircle2 size={16} /> Connected
                            </div>
                        ) : (
                            <button 
                                onClick={handleConnectDrive}
                                disabled={isValidating}
                                className="w-full py-2 bg-white dark:bg-[#272727] border border-slate-200 dark:border-[#3f3f3f] hover:bg-slate-50 dark:hover:bg-[#333] text-slate-700 dark:text-zinc-200 font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                            >
                                {isValidating ? <Loader2 size={16} className="animate-spin" /> : <img src="https://upload.wikimedia.org/wikipedia/commons/d/da/Google_Drive_logo.png" className="w-4 h-4" alt="Drive"/>}
                                Connect Google Drive
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-500">
                        Note: Access tokens expire after 1 hour. If uploads fail, please reconnect here.
                    </p>
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
                 <div className="space-y-5">
                     {/* URL Section */}
                     <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Jira Site URL</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#0052CC] focus:border-transparent p-3 pr-10 text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                placeholder="https://your-company.atlassian.net"
                                value={formData.jiraUrl || ''}
                                onChange={(e) => handleChange('jiraUrl', e.target.value)}
                                onBlur={handleJiraUrlBlur}
                            />
                            <Globe className="absolute right-3 top-3.5 text-slate-400 dark:text-zinc-500" size={16} />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 flex items-center gap-1">
                            <Info size={12}/> Paste any link from your Jira project, we'll extract the domain.
                        </p>
                     </div>

                     {/* Credentials Section */}
                     <div className="bg-slate-50 dark:bg-[#272727] p-4 rounded-xl border border-slate-100 dark:border-[#333] space-y-4">
                         <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Email Address</label>
                            <div className="relative">
                                <input 
                                    type="email" 
                                    className="w-full bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#0052CC] focus:border-transparent p-2.5 pl-3 pr-10 text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                    placeholder="user@company.com"
                                    value={formData.jiraEmail || ''}
                                    onChange={(e) => handleChange('jiraEmail', e.target.value)}
                                />
                                <Mail className="absolute right-3 top-2.5 text-slate-400 dark:text-zinc-500" size={16} />
                            </div>
                         </div>
                         <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300">API Token</label>
                                <a 
                                    href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-xs font-bold text-[#0052CC] hover:underline flex items-center gap-1"
                                >
                                    Generate Token <ExternalLink size={10} />
                                </a>
                            </div>
                            <div className="relative">
                                <input 
                                    type="password" 
                                    className="w-full bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#0052CC] focus:border-transparent p-2.5 pl-3 pr-10 font-mono text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                    placeholder="Paste API Token here"
                                    value={formData.jiraToken || ''}
                                    onChange={(e) => handleChange('jiraToken', e.target.value)}
                                />
                                <Key className="absolute right-3 top-2.5 text-slate-400 dark:text-zinc-500" size={16} />
                            </div>
                         </div>
                     </div>
                 </div>
            );
        case 'Teams':
            return (
                 <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Incoming Webhook URL</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#5059C9] focus:border-transparent p-3 pr-10 text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                placeholder="https://your-org.webhook.office.com/..."
                                value={formData.teamsWebhookUrl || ''}
                                onChange={(e) => handleChange('teamsWebhookUrl', e.target.value)}
                            />
                            <LinkIcon className="absolute right-3 top-3.5 text-slate-400 dark:text-zinc-500" size={16} />
                        </div>
                     </div>
                     
                     <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                        <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                            <strong>How to get this URL:</strong><br/>
                            1. In Teams, go to the channel you want to post to.<br/>
                            2. Click <strong>•••</strong> &gt; <strong>Connectors</strong>.<br/>
                            3. Search for <strong>"Incoming Webhook"</strong> &gt; Click <strong>Configure</strong>.<br/>
                            4. Give it a name (e.g. BugSnap) &gt; Create &gt; Copy URL.
                        </p>
                     </div>
                 </div>
            );
         case 'Asana':
             return (
                 <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Personal Access Token</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-[#F06A6A] focus:border-transparent p-3 pr-10 font-mono text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                placeholder="1/120..."
                                value={formData.asanaToken || ''}
                                onChange={(e) => handleChange('asanaToken', e.target.value)}
                            />
                            <Lock className="absolute right-3 top-3.5 text-slate-400 dark:text-zinc-500" size={16} />
                        </div>
                    </div>
                </div>
             );
        case 'Webhook':
            return (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Webhook URL</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg shadow-sm focus:ring-2 focus:ring-pink-600 focus:border-transparent p-3 pr-10 text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400"
                                placeholder="https://hooks.zapier.com/hooks/catch/..."
                                value={formData.webhookUrl || ''}
                                onChange={(e) => handleChange('webhookUrl', e.target.value)}
                            />
                            <LinkIcon className="absolute right-3 top-3.5 text-slate-400 dark:text-zinc-500" size={16} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Supports Zapier, Make, or any custom endpoint. Payload includes JSON with base64 images.
                        </p>
                    </div>
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
        case 'Teams': return '#5059C9';
        case 'Asana': return '#F06A6A';
        case 'Trello': return '#0079BF';
        case 'Webhook': return '#db2777';
        case 'GoogleDrive': return '#34A853';
        default: return '#3b82f6';
    }
  };

  const getIcon = () => {
    switch(source) {
        case 'ClickUp': return <Layers size={20} />;
        case 'Slack': return <Slack size={20} />;
        case 'Jira': return <CreditCard size={20} />;
        case 'Teams': return <Users size={20} />;
        case 'Asana': return <CheckCircle2 size={20} />;
        case 'Trello': return <Trello size={20} />;
        case 'Webhook': return <Webhook size={20} />;
        case 'GoogleDrive': return <HardDrive size={20} />;
        default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in p-4">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#272727] transition-colors">
        <div className="p-4 flex items-center justify-between text-white" style={{ backgroundColor: getColor() }}>
           <div className="flex items-center gap-2 font-bold text-lg">
             {getIcon()}
             <span>Connect {source === 'GoogleDrive' ? 'Drive' : source}</span>
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
