
import React, { useState, useEffect, useMemo } from 'react';
import { ReportedIssue, IssueMetric, IntegrationConfig, IntegrationSource, ClickUpHierarchyList, DashboardFilter, SortField, SortOrder, AsanaProject } from '../types';
import { fetchClickUpTasks, getAllClickUpLists } from '../services/clickUpService';
import { fetchSlackHistory, postSlackMessage, generateDashboardSummary } from '../services/slackService';
import { fetchJiraIssues } from '../services/jiraService';
import { postTeamsMessage } from '../services/teamsService';
import { fetchAsanaTasks, getAsanaWorkspaces, getAsanaProjects } from '../services/asanaService';
import { fetchTrelloCards } from '../services/trelloService';
import { fetchZohoSprintsItems } from '../services/zohoSprintsService';
import { useToast } from './ToastProvider';
import { IntegrationModal } from './IntegrationModal';
import { 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Slack, 
  Layers, 
  Video,
  Upload,
  Filter,
  Search,
  ChevronUp,
  ChevronDown,
  LayoutTemplate,
  AlertTriangle,
  RefreshCcw,
  CreditCard,
  Briefcase,
  Database,
  Plus,
  Users,
  Trello
} from 'lucide-react';

const KPICard = ({ label, value, color, icon }: { label: string, value: string | number, color: string, icon: React.ReactNode }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  };

  return (
    <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-[#272727] flex items-center gap-4 transition-colors">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
};

const getPriorityBadge = (priority: string) => {
  const styles: Record<string, string> = {
    Urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    High: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    Normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    Low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    None: 'bg-slate-50 text-slate-500 dark:bg-[#272727] dark:text-zinc-400 border-slate-200 dark:border-[#3f3f3f]'
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[priority] || styles.None}`}>
      {priority}
    </span>
  );
};

interface DashboardProps {
  onCapture: () => void;
  onRecord: () => void;
  onUpload: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onCapture, onRecord, onUpload }) => {
  const [activeSource, setActiveSource] = useState<IntegrationSource>('ClickUp');
  const [connectedSources, setConnectedSources] = useState<IntegrationSource[]>([]);
  const [issues, setIssues] = useState<ReportedIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ClickUp Lists
  const [availableLists, setAvailableLists] = useState<ClickUpHierarchyList[]>([]);
  
  // Asana Projects (For Filtering)
  const [asanaProjects, setAsanaProjects] = useState<AsanaProject[]>([]);
  const [selectedAsanaProjectId, setSelectedAsanaProjectId] = useState('');

  // Initialize with persisted list ID if available
  const [selectedListId, setSelectedListId] = useState<string>(() => {
      try {
        const savedConfig = localStorage.getItem('bugsnap_config');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            return config.clickUpListId || '';
        }
      } catch (e) {
          console.error("Failed to parse config", e);
      }
      return '';
  });
  
  const [isLoadingLists, setIsLoadingLists] = useState(false);

  // Filters & Sort
  const [filters, setFilters] = useState<DashboardFilter>({
      dateRange: 'all',
      assignee: '',
      priority: []
  });
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchText, setSearchText] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isSharingTeams, setIsSharingTeams] = useState(false);
  
  // Integration Modal State
  const [integrationModalSource, setIntegrationModalSource] = useState<IntegrationSource | null>(null);

  const { addToast } = useToast();

  // Load Configuration and Sources
  useEffect(() => {
     try {
         const savedConfig = localStorage.getItem('bugsnap_config');
         if (savedConfig) {
             const config: IntegrationConfig = JSON.parse(savedConfig);
             
             const connected: IntegrationSource[] = [];
             if (config.clickUpToken) connected.push('ClickUp');
             if (config.jiraToken) connected.push('Jira');
             if (config.slackToken) connected.push('Slack');
             if (config.teamsWebhookUrl) connected.push('Teams'); // Updated to use webhookUrl check
             if (config.asanaToken) connected.push('Asana');
             if (config.trelloToken) connected.push('Trello');
             if (config.zohoSprintsToken) connected.push('ZohoSprints');
             
             setConnectedSources(connected);

             // If current active source is not connected, switch to first available
             if (connected.length > 0 && !connected.includes(activeSource)) {
                 setActiveSource(connected[0]);
             }

             // ClickUp Lists
             if (config.clickUpToken) {
                 setIsLoadingLists(true);
                 getAllClickUpLists(config.clickUpToken)
                     .then(lists => {
                         setAvailableLists(lists);
                         if (!selectedListId) {
                             if (config.clickUpListId) {
                                 setSelectedListId(config.clickUpListId);
                             } else if (lists.length > 0) {
                                 setSelectedListId(lists[0].id);
                             }
                         }
                     })
                     .catch(err => {
                         console.error("Failed to load lists for dashboard", err);
                         if (err.message === 'corsdemo_required') {
                             setError('corsdemo_required');
                         }
                     })
                     .finally(() => setIsLoadingLists(false));
             }

             // Asana Projects
             if (config.asanaToken) {
                 getAsanaWorkspaces(config.asanaToken).then(ws => {
                     if (ws.length > 0) {
                         getAsanaProjects(config.asanaToken!, ws[0].gid).then(projs => {
                             setAsanaProjects(projs);
                             if (projs.length > 0) setSelectedAsanaProjectId(projs[0].gid);
                         });
                     }
                 }).catch(err => console.error(err));
             }
         }
     } catch(e) { console.error("Config load error", e); }
  }, []);

  const handleListChange = (newListId: string) => {
      setSelectedListId(newListId);
      try {
          const savedConfig = localStorage.getItem('bugsnap_config');
          if (savedConfig) {
              const config = JSON.parse(savedConfig);
              config.clickUpListId = newListId;
              const listName = availableLists.find(l => l.id === newListId)?.name;
              if (listName) config.clickUpListName = listName;
              localStorage.setItem('bugsnap_config', JSON.stringify(config));
          }
      } catch (e) { console.error("Failed to save list selection", e); }
  };

  const handleRefresh = () => {
      loadData(true);
  };

  // --- Data Loading ---
  const loadData = async (isRefresh = false, overrideListId?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
        const savedConfig = localStorage.getItem('bugsnap_config');
        if (!savedConfig) {
          setError("No configuration found. Please set up your integrations.");
          setIsLoading(false);
          return;
        }

        const config: IntegrationConfig = JSON.parse(savedConfig);
        const targetListId = overrideListId || selectedListId || config.clickUpListId;

        if (activeSource === 'ClickUp') {
            if (!config.clickUpToken || !targetListId) {
                if (!targetListId && availableLists.length > 0) {
                    // Wait for selection
                } else if (!config.clickUpToken) {
                    setError("ClickUp is not fully configured. Please go to Integrations.");
                }
                setIssues([]);
                setIsLoading(false);
                return;
            }
            const tasks = await fetchClickUpTasks(targetListId, config.clickUpToken);
            setIssues(tasks);
        } 
        else if (activeSource === 'Jira') {
            if (!config.jiraUrl || !config.jiraToken || !config.jiraEmail) {
                setError("Jira is not configured.");
                setIssues([]);
                setIsLoading(false);
                return;
            }
            const jiraIssues = await fetchJiraIssues({
                domain: config.jiraUrl,
                email: config.jiraEmail,
                token: config.jiraToken
            });
            setIssues(jiraIssues);
        }
        else if (activeSource === 'Slack') {
            if (!config.slackToken || !config.slackChannel) {
                setError("Slack is not configured.");
                setIssues([]);
                setIsLoading(false);
                return;
            }
            const history = await fetchSlackHistory(config.slackToken, config.slackChannel);
            setIssues(history);
        }
        else if (activeSource === 'Asana') {
            if (!config.asanaToken) {
                setError("Asana is not configured.");
                setIssues([]);
                setIsLoading(false);
                return;
            }
            if (!selectedAsanaProjectId) {
                setIssues([]);
                setIsLoading(false);
                return;
            }
            const asanaTasks = await fetchAsanaTasks(config.asanaToken, selectedAsanaProjectId);
            setIssues(asanaTasks);
        }
        else if (activeSource === 'Trello') {
            if (!config.trelloApiKey || !config.trelloToken) {
                setError("Trello is not configured.");
                setIssues([]);
                setIsLoading(false);
                return;
            }
            const trelloCards = await fetchTrelloCards(config.trelloApiKey, config.trelloToken);
            setIssues(trelloCards);
        }
        else if (activeSource === 'ZohoSprints') {
            if (!config.zohoSprintsToken || !config.zohoSprintsDC) {
                setError("Zoho Sprints is not configured.");
                setIssues([]);
                setIsLoading(false);
                return;
            }
            setError("Select a Team/Project context feature coming soon for Zoho Sprints dashboard.");
            setIssues([]);
        }
        
        if (isRefresh) addToast("Dashboard updated", 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      if (isRefresh && msg !== 'corsdemo_required') addToast("Failed to refresh data", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger load when source or list changes
  useEffect(() => {
    loadData();
  }, [activeSource, selectedListId, selectedAsanaProjectId]);


  // --- Derived Data (Filtering & Analytics) ---
  const processedData = useMemo(() => {
      let data = [...issues];

      // 1. Search
      if (searchText) {
          const lower = searchText.toLowerCase();
          data = data.filter(i => 
              i.title.toLowerCase().includes(lower) || 
              i.id.toLowerCase().includes(lower) ||
              i.assignee?.toLowerCase().includes(lower)
          );
      }

      // 2. Filters
      if (filters.status && filters.status.length > 0) {
          data = data.filter(i => filters.status!.includes(i.status));
      }
      
      // Priority Filter
      if (filters.priority && filters.priority.length > 0) {
          data = data.filter(i => filters.priority!.includes(i.priority));
      }

      // Assignee Filter
      if (filters.assignee) {
          data = data.filter(i => i.assignee === filters.assignee);
      }

      // Date Range logic
      if (filters.dateRange && filters.dateRange !== 'all') {
          const now = new Date();
          const cutoff = new Date();
          if (filters.dateRange === '24h') cutoff.setHours(now.getHours() - 24);
          if (filters.dateRange === '7d') cutoff.setDate(now.getDate() - 7);
          if (filters.dateRange === '30d') cutoff.setDate(now.getDate() - 30);
          
          data = data.filter(i => new Date(i.date) >= cutoff);
      }

      // 3. Sorting
      data.sort((a, b) => {
          let valA: any = a[sortField];
          let valB: any = b[sortField];

          if (sortField === 'date') {
              valA = new Date(a.date).getTime();
              valB = new Date(b.date).getTime();
          }
          if (sortField === 'priority') {
              const pMap = { Urgent: 4, High: 3, Normal: 2, Low: 1, None: 0 };
              valA = pMap[a.priority] || 0;
              valB = pMap[b.priority] || 0;
          }

          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
      });

      return data;
  }, [issues, filters, sortField, sortOrder, searchText]);

  const uniqueAssignees = useMemo(() => {
      const assignees = new Set<string>();
      issues.forEach(i => {
          if (i.assignee) assignees.add(i.assignee);
      });
      return Array.from(assignees);
  }, [issues]);

  // Analytics Calculations
  const metrics = useMemo(() => {
      const total = processedData.length;
      const resolvedStatuses = ['complete', 'closed', 'resolved', 'done', 'completed'];
      const resolvedCount = processedData.filter(i => resolvedStatuses.includes(i.status.toLowerCase())).length;
      const openCount = total - resolvedCount;
      const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;
      
      // Priority Distribution for Slack
      const priorityDist = { Urgent: 0, High: 0, Normal: 0, Low: 0 };
      processedData.forEach(i => { if (priorityDist[i.priority] !== undefined) priorityDist[i.priority]++; });
      const priorityData = Object.keys(priorityDist).map(k => ({ name: k, count: priorityDist[k as keyof typeof priorityDist] }));

      return { total, openCount, resolvedCount, resolutionRate, priorityData };
  }, [processedData]);

  const handleShareDashboardToSlack = async () => {
     setIsSharing(true);
     
     try {
        const savedConfig = localStorage.getItem('bugsnap_config');
        if (!savedConfig) {
            setIntegrationModalSource('Slack');
            setIsSharing(false);
            return;
        }
        const config: IntegrationConfig = JSON.parse(savedConfig);

        if (!config.slackToken || !config.slackChannel) {
            setIntegrationModalSource('Slack');
            setIsSharing(false);
            return;
        }

        addToast("Posting summary to Slack...", 'info');

        const summary = generateDashboardSummary(metrics);
        await postSlackMessage(config.slackToken, config.slackChannel, summary);
        addToast("Dashboard summary shared to Slack!", 'success');
     } catch (e) {
         console.error(e);
         const msg = e instanceof Error ? e.message : "Failed to post to Slack";
         
         if (msg.includes('corsdemo')) {
             addToast(
                 <span>
                    Proxy Locked. <a href="https://cors-anywhere.herokuapp.com/corsdemo" target="_blank" className="underline font-bold">Unlock Here</a>
                 </span>, 
                 'error'
             );
         } else {
             addToast(msg, 'error');
         }
     } finally {
         setIsSharing(false);
     }
  };

  const handleShareDashboardToTeams = async () => {
     setIsSharingTeams(true);
     
     try {
        const savedConfig = localStorage.getItem('bugsnap_config');
        if (!savedConfig) {
            setIntegrationModalSource('Teams');
            setIsSharingTeams(false);
            return;
        }
        const config: IntegrationConfig = JSON.parse(savedConfig);

        if (!config.teamsWebhookUrl) {
            setIntegrationModalSource('Teams');
            setIsSharingTeams(false);
            return;
        }

        addToast("Posting summary to Teams...", 'info');

        // Create Teams-friendly markdown summary
        const priorityText = (metrics.priorityData || [])
            .map((p: any) => `- **${p.name}**: ${p.count}`)
            .join('\n');

        const summary = `**BugSnap Dashboard Report**\n\n` +
               `✅ **Resolved Issues:** ${metrics.resolvedCount}\n\n` +
               `⏳ **Pending Issues:** ${metrics.openCount}\n\n` +
               `**Priority Breakdown:**\n${priorityText || 'No active issues'}`;

        await postTeamsMessage(config.teamsWebhookUrl, undefined, summary);
        addToast("Dashboard summary shared to Teams!", 'success');
     } catch (e) {
         console.error(e);
         const msg = e instanceof Error ? e.message : "Failed to post to Teams";
         
         if (msg.includes('corsdemo')) {
             addToast(
                 <span>
                    Proxy Locked. <a href="https://cors-anywhere.herokuapp.com/corsdemo" target="_blank" className="underline font-bold">Unlock Here</a>
                 </span>, 
                 'error'
             );
         } else {
             addToast(msg, 'error');
         }
     } finally {
         setIsSharingTeams(false);
     }
  };

  const handleSaveIntegration = (newConfig: IntegrationConfig) => {
      try {
        const saved = localStorage.getItem('bugsnap_config');
        const current = saved ? JSON.parse(saved) : {};
        const updated = { ...current, ...newConfig };
        localStorage.setItem('bugsnap_config', JSON.stringify(updated));
        
        addToast(`${integrationModalSource} connected!`, 'success');
        setIntegrationModalSource(null);
        
        // Reload data and re-evaluate connected sources
        window.location.reload(); // Simple way to refresh entire state incl. connectedSources
      } catch (e) {
          addToast("Failed to save configuration", "error");
      }
  };

  // Sort Handler
  const toggleSort = (field: SortField) => {
      if (sortField === field) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
          setSortField(field);
          setSortOrder('desc');
      }
  };

  // Icon Helper
  const getSourceIcon = (source: IntegrationSource) => {
      switch(source) {
          case 'ClickUp': return <Layers size={16} />;
          case 'Jira': return <CreditCard size={16} />;
          case 'Slack': return <Slack size={16} />;
          case 'Asana': return <CheckCircle2 size={16} />;
          case 'Trello': return <Trello size={16} />;
          case 'ZohoSprints': return <Database size={16} />;
          default: return <Layers size={16} />;
      }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0f0f0f] transition-colors">
      
      <IntegrationModal 
        isOpen={!!integrationModalSource}
        source={integrationModalSource}
        onClose={() => setIntegrationModalSource(null)}
        currentConfig={(() => {
            try {
                const saved = localStorage.getItem('bugsnap_config');
                return saved ? JSON.parse(saved) : {};
            } catch (e) { return {}; }
        })()}
        onSave={handleSaveIntegration}
      />

      <div className="p-8 max-w-7xl mx-auto w-full">
        
        {/* 1. Top Section: Quick Actions Container */}
        <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-[#272727] mb-8 transition-colors">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={onCapture} className="bg-slate-50 dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#3f3f3f] hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 flex items-center gap-4 group transition-all">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition"><LayoutTemplate size={20}/></div>
                    <div className="text-left"><h3 className="font-bold text-slate-900 dark:text-white">Capture Screenshots</h3><p className="text-xs text-slate-500 dark:text-zinc-400">Capture any tab</p></div>
                </button>
                <button onClick={onRecord} className="bg-slate-50 dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#3f3f3f] hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 flex items-center gap-4 group transition-all">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition"><Video size={20}/></div>
                    <div className="text-left"><h3 className="font-bold text-slate-900 dark:text-white">Record Video</h3><p className="text-xs text-slate-500 dark:text-zinc-400">Evidence clip</p></div>
                </button>
                <button onClick={onUpload} className="bg-slate-50 dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#3f3f3f] hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 flex items-center gap-4 group transition-all">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition"><Upload size={20}/></div>
                    <div className="text-left"><h3 className="font-bold text-slate-900 dark:text-white">Upload File</h3><p className="text-xs text-slate-500 dark:text-zinc-400">Drag & Drop</p></div>
                </button>
            </div>
        </div>

        {/* 2. Visual Separator */}
        <hr className="border-slate-200 dark:border-[#272727] mb-8 transition-colors" />

        {/* 3. Header Row: Title & Source Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 dark:bg-[#272727] p-1 rounded-xl">
                    {/* Dynamic Source Selector */}
                    {connectedSources.length > 1 ? (
                        <div className="relative">
                            <select 
                                value={activeSource}
                                onChange={(e) => setActiveSource(e.target.value as IntegrationSource)}
                                className="appearance-none pl-10 pr-10 py-2 rounded-lg text-sm font-bold bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white shadow-sm focus:outline-none cursor-pointer min-w-[160px]"
                            >
                                {connectedSources.map(source => (
                                    <option key={source} value={source}>{source}</option>
                                ))}
                            </select>
                            <div className="absolute left-3 top-2.5 text-slate-500 dark:text-zinc-400 pointer-events-none">
                                {getSourceIcon(activeSource)}
                            </div>
                            <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                        </div>
                    ) : connectedSources.length === 1 ? (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white shadow-sm">
                            {getSourceIcon(connectedSources[0])}
                            {connectedSources[0]}
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIntegrationModalSource('ClickUp')} // Default to ClickUp modal prompt
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 dark:bg-[#333] text-slate-600 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-[#444] transition"
                        >
                            <Plus size={16} /> Connect Integrations
                        </button>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {/* List Selector (Context Switcher) */}
                {activeSource === 'ClickUp' && (
                    <div className="flex items-center gap-2 bg-white dark:bg-[#1e1e1e] p-2 rounded-xl border border-slate-200 dark:border-[#272727] shadow-sm transition-colors">
                        <div className="bg-[#7B68EE]/10 dark:bg-[#7B68EE]/20 p-1.5 rounded-lg text-[#7B68EE] dark:text-[#9d8ef0]">
                            <Layers size={18} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase px-2 hidden sm:inline">List:</span>
                        <div className="relative min-w-[150px] sm:min-w-[200px]">
                            <select 
                                value={selectedListId} 
                                onChange={(e) => handleListChange(e.target.value)}
                                className="w-full appearance-none bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg py-1.5 pl-3 pr-8 text-sm font-bold text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-[#7B68EE] focus:border-transparent outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-[#222] transition"
                                disabled={isLoadingLists}
                            >
                                {availableLists.map(l => (
                                    <option key={l.id} value={l.id}>{l.groupName} &gt; {l.name}</option>
                                ))}
                                {availableLists.length === 0 && <option value="">{isLoadingLists ? 'Loading lists...' : 'No lists found'}</option>}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"/>
                        </div>
                        <button 
                            onClick={handleRefresh} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#7B68EE] hover:bg-[#7B68EE]/5 dark:hover:bg-[#7B68EE]/10 transition"
                            title="Refresh Data"
                            disabled={isLoading}
                        >
                            <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                )}
                 
                 {activeSource === 'Jira' && (
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-500">Jira Projects</span>
                        <button 
                            onClick={handleRefresh} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0052CC] transition"
                            title="Refresh Data"
                            disabled={isLoading}
                        >
                            <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} />
                        </button>
                     </div>
                 )}
                 
                 {activeSource === 'Asana' && (
                    <div className="flex items-center gap-2 bg-white dark:bg-[#1e1e1e] p-2 rounded-xl border border-slate-200 dark:border-[#272727] shadow-sm transition-colors">
                        <div className="bg-[#F06A6A]/10 dark:bg-[#F06A6A]/20 p-1.5 rounded-lg text-[#F06A6A] dark:text-[#F06A6A]">
                            <Briefcase size={18} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase px-2 hidden sm:inline">Project:</span>
                        <div className="relative min-w-[150px] sm:min-w-[200px]">
                            <select 
                                value={selectedAsanaProjectId} 
                                onChange={(e) => setSelectedAsanaProjectId(e.target.value)}
                                className="w-full appearance-none bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg py-1.5 pl-3 pr-8 text-sm font-bold text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-[#F06A6A] focus:border-transparent outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-[#222] transition"
                            >
                                {asanaProjects.map(p => (
                                    <option key={p.gid} value={p.gid}>{p.name}</option>
                                ))}
                                {asanaProjects.length === 0 && <option value="">No Projects Found</option>}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"/>
                        </div>
                        <button 
                            onClick={handleRefresh} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#F06A6A] hover:bg-[#F06A6A]/5 dark:hover:bg-[#F06A6A]/10 transition"
                            title="Refresh Data"
                            disabled={isLoading}
                        >
                            <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                 )}

                 {activeSource === 'Trello' && (
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-500">My Cards</span>
                        <button 
                            onClick={handleRefresh} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0079BF] transition"
                            title="Refresh Data"
                            disabled={isLoading}
                        >
                            <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} />
                        </button>
                     </div>
                 )}

                {/* Share Summary Button (Slack) */}
                 <button 
                    onClick={handleShareDashboardToSlack} 
                    disabled={isSharing}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#4A154B] hover:bg-[#3f1240] rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-50 h-[46px]"
                >
                    <Slack size={16} /> <span className="hidden sm:inline">{isSharing ? 'Posting...' : 'Share to Slack'}</span>
                </button>

                {/* Share Summary Button (Teams) */}
                <button 
                    onClick={handleShareDashboardToTeams} 
                    disabled={isSharingTeams}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#5059C9] hover:bg-[#434aa8] rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-50 h-[46px]"
                >
                    <Users size={16} /> <span className="hidden sm:inline">{isSharingTeams ? 'Posting...' : 'Share to Teams'}</span>
                </button>
            </div>
        </div>

        {/* 4. KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPICard label="Total Issues" value={metrics.total} color="blue" icon={<AlertCircle size={18}/>} />
            <KPICard label="Open Issues" value={metrics.openCount} color="orange" icon={<Clock size={18}/>} />
            <KPICard label="Resolved Issues" value={metrics.resolvedCount} color="green" icon={<CheckCircle2 size={18}/>} />
            <KPICard label="Resolution Rate" value={`${metrics.resolutionRate}%`} color="indigo" icon={<CheckCircle2 size={18}/>} />
        </div>

        {/* 5. Filters (Filters positioned above bug table) */}
        <div className="bg-white dark:bg-[#1e1e1e] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-[#272727] mb-6 flex flex-wrap items-center gap-4 transition-colors">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 mr-2">
                <Filter size={16} /> <span className="text-sm font-bold">Filters</span>
            </div>
            
            <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-400"/>
                <input 
                    type="text" 
                    placeholder="Search bugs..." 
                    className="pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-40 text-slate-900 dark:text-zinc-100 placeholder-slate-400 transition-colors"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-[#272727] mx-2 hidden md:block"></div>

            {/* Date Range Filter */}
            <div className="relative">
                <select 
                    className="bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg py-2.5 pl-3 pr-8 text-sm text-slate-600 dark:text-zinc-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#222] focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-colors"
                    value={filters.dateRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
                >
                    <option value="all">All Time</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none"/>
            </div>

            {/* Priority Filter */}
            <div className="relative">
                <select
                    className="bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg py-2.5 pl-3 pr-8 text-sm text-slate-600 dark:text-zinc-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#222] focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-colors"
                    value={filters.priority && filters.priority.length > 0 ? filters.priority[0] : ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        setFilters(prev => ({ ...prev, priority: val ? [val] : [] }));
                    }}
                >
                    <option value="">All Priorities</option>
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Normal">Normal</option>
                    <option value="Low">Low</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none"/>
            </div>

            {/* Assignee Filter */}
            <div className="relative">
                <select
                    className="bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg py-2.5 pl-3 pr-8 text-sm text-slate-600 dark:text-zinc-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#222] focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-colors"
                    value={filters.assignee || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
                >
                    <option value="">All Assignees</option>
                    {uniqueAssignees.map(user => (
                        <option key={user} value={user}>{user}</option>
                    ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none"/>
            </div>
        </div>

        {/* Error State */}
        {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-8 flex items-start gap-3 text-red-800 dark:text-red-300">
                <AlertTriangle className="shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-bold">Connection Issue</h3>
                    {error === 'corsdemo_required' ? (
                        <div className="mt-1">
                             <p className="text-sm mb-2">The browser proxy requires a one-time verification.</p>
                             <a href="https://cors-anywhere.herokuapp.com/corsdemo" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold underline hover:text-red-900 dark:hover:text-red-200">
                                <ExternalLink size={12}/> Unlock Proxy Here
                             </a>
                             <span className="text-xs ml-2 opacity-75">(Then refresh)</span>
                        </div>
                    ) : (
                        <p className="text-sm mt-1">{error}</p>
                    )}
                </div>
            </div>
        )}

        {/* 6. Bug Table */}
        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-sm border border-slate-200 dark:border-[#272727] overflow-hidden transition-colors">
             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-slate-50 dark:bg-[#272727] text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-xs border-b border-slate-200 dark:border-[#272727]">
                         <tr>
                             <th className="px-6 py-4 font-bold cursor-pointer hover:text-slate-700 dark:hover:text-zinc-300" onClick={() => toggleSort('date')}>
                                 <div className="flex items-center gap-1">Date {sortField === 'date' && (sortOrder === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                             </th>
                             <th className="px-6 py-4 font-bold dark:text-zinc-300">Bug Title</th>
                             <th className="px-6 py-4 font-bold cursor-pointer hover:text-slate-700 dark:hover:text-zinc-300" onClick={() => toggleSort('priority')}>
                                 <div className="flex items-center gap-1">Priority {sortField === 'priority' && (sortOrder === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                             </th>
                             <th className="px-6 py-4 font-bold cursor-pointer hover:text-slate-700 dark:hover:text-zinc-300" onClick={() => toggleSort('status')}>
                                 <div className="flex items-center gap-1">Status {sortField === 'status' && (sortOrder === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                             </th>
                             <th className="px-6 py-4 font-bold dark:text-zinc-300">Assignee</th>
                             <th className="px-6 py-4 font-bold w-20 dark:text-zinc-300">Action</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-[#272727]">
                         {processedData.length === 0 ? (
                             <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-zinc-500">No bugs found matching your filters.</td></tr>
                         ) : (
                             processedData.map(issue => (
                                 <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-[#272727] transition group">
                                     <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 whitespace-nowrap">{issue.date}</td>
                                     <td className="px-6 py-4">
                                         <div className="font-bold text-slate-800 dark:text-zinc-200 line-clamp-1">{issue.title}</div>
                                         <div className="flex items-center gap-2 mt-1">
                                             <span className="text-xs text-slate-400 font-mono">#{issue.id}</span>
                                             {issue.module && <span className="text-[10px] bg-slate-100 dark:bg-[#272727] text-slate-500 dark:text-zinc-300 px-1.5 rounded">{issue.module}</span>}
                                         </div>
                                     </td>
                                     <td className="px-6 py-4">{getPriorityBadge(issue.priority)}</td>
                                     <td className="px-6 py-4">
                                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white capitalize" style={{ backgroundColor: issue.statusColor }}>
                                             {issue.status}
                                         </span>
                                     </td>
                                     <td className="px-6 py-4">
                                         {issue.assignee ? (
                                             <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300">
                                                 <div className="w-6 h-6 bg-slate-200 dark:bg-[#3f3f3f] rounded-full flex items-center justify-center text-xs font-bold">{issue.assignee.charAt(0).toUpperCase()}</div>
                                                 <span className="truncate max-w-[100px]">{issue.assignee}</span>
                                             </div>
                                         ) : <span className="text-slate-400 text-xs italic">Unassigned</span>}
                                     </td>
                                     <td className="px-6 py-4">
                                         {issue.url && (
                                             <a href={issue.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full inline-block transition">
                                                 <ExternalLink size={16} />
                                             </a>
                                         )}
                                     </td>
                                 </tr>
                             ))
                         )}
                     </tbody>
                 </table>
             </div>
             {/* Pagination (Simple) */}
             <div className="p-4 border-t border-slate-200 dark:border-[#272727] bg-slate-50 dark:bg-[#0f0f0f] text-xs text-slate-500 dark:text-zinc-400 text-center transition-colors">
                 Showing {processedData.length} of {issues.length} records
             </div>
        </div>

      </div>
    </div>
  );
};
