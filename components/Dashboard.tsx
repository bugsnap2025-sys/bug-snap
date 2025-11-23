
import React, { useState, useEffect, useMemo } from 'react';
import { ReportedIssue, IssueMetric, IntegrationConfig, IntegrationSource } from '../types';
import { fetchClickUpTasks } from '../services/clickUpService';
import { fetchSlackHistory, postSlackMessage, generateDashboardSummary } from '../services/slackService';
import { useToast } from './ToastProvider';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Slack, 
  Layers, 
  CreditCard, 
  RefreshCw, 
  AlertTriangle,
  Calendar,
  UserCircle,
  MessageSquare,
  Camera,
  Video,
  Upload,
  LayoutTemplate,
  Zap
} from 'lucide-react';

interface DashboardProps {
  onCapture: () => void;
  onRecord: () => void;
  onUpload: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onCapture, onRecord, onUpload }) => {
  const [activeSource, setActiveSource] = useState<IntegrationSource>('ClickUp');
  const [issues, setIssues] = useState<ReportedIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // --- Data Loading ---
  const loadData = async (isRefresh = false) => {
    setIsLoading(true);
    setError(null);
    
    const savedConfig = localStorage.getItem('bugsnap_config');
    if (!savedConfig) {
      setError("No configuration found. Please set up your integrations in Settings.");
      setIsLoading(false);
      return;
    }

    const config: IntegrationConfig = JSON.parse(savedConfig);

    try {
      if (activeSource === 'ClickUp') {
        if (!config.clickUpToken || !config.clickUpListId) {
          setError("ClickUp is not configured. Add your API Token and List ID in Settings.");
          setIssues([]);
          return;
        }
        const tasks = await fetchClickUpTasks(config.clickUpListId, config.clickUpToken);
        setIssues(tasks);
      } 
      else if (activeSource === 'Jira') {
        if (!config.jiraUrl || !config.jiraToken) {
          setError("Jira is not configured. Add your URL and Token in Settings.");
          setIssues([]);
          return;
        }
        setIssues([]); 
        setError("Jira integration is configured but fetching is coming soon.");
      }
      else if (activeSource === 'Slack') {
         if (!config.slackToken || !config.slackChannel) {
             setError("Slack is not configured. Add your Bot Token and Channel ID in Settings.");
             setIssues([]);
             return;
         }
         const history = await fetchSlackHistory(config.slackToken, config.slackChannel);
         setIssues(history);
      }
      
      if (isRefresh) addToast("Dashboard updated", 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('Failed to fetch')) {
         setError("Network Error: Could not connect to the API. Please disable ad-blockers or check your proxy settings.");
      } else if (msg.includes('401') || msg.includes('invalid_auth')) {
         setError("Authentication Failed: Please check your API Token in Settings.");
      } else {
         setError(msg);
      }
      if (isRefresh) addToast("Failed to refresh data", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSource]);

  // --- Calculations ---
  const metrics = useMemo(() => {
    // For Slack, resolution rate doesn't make sense in the same way, but we show counts
    const total = issues.length;
    
    // Define "Resolved" statuses
    const resolvedStatuses = ['complete', 'closed', 'resolved', 'done'];
    const resolvedCount = issues.filter(i => resolvedStatuses.includes(i.status.toLowerCase())).length;
    const openCount = total - resolvedCount;
    const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;

    // Distribution
    const statusDist: Record<string, number> = {};
    issues.forEach(i => {
      const s = i.status.toLowerCase();
      statusDist[s] = (statusDist[s] || 0) + 1;
    });

    const chartData: IssueMetric[] = Object.keys(statusDist).map((key, idx) => ({
      status: key.charAt(0).toUpperCase() + key.slice(1),
      count: statusDist[key],
      fill: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][idx % 5]
    }));

    return { total, openCount, resolvedCount, resolutionRate, chartData };
  }, [issues]);


  // --- Actions ---
  const handleShareDashboardToSlack = async () => {
    const savedConfig = localStorage.getItem('bugsnap_config');
    if (!savedConfig) return;
    const config: IntegrationConfig = JSON.parse(savedConfig);
    
    if (!config.slackToken || !config.slackChannel) {
        addToast("Slack not configured.", 'error');
        return;
    }

    const summary = generateDashboardSummary(metrics);
    try {
        await postSlackMessage(config.slackToken, config.slackChannel, summary);
        addToast("Dashboard summary posted to Slack!", 'success');
    } catch (e) {
        addToast("Failed to post to Slack: " + (e instanceof Error ? e.message : 'Unknown error'), 'error');
    }
  };

  const handleShareIssueToSlack = async (issue: ReportedIssue) => {
    const savedConfig = localStorage.getItem('bugsnap_config');
    if (!savedConfig) return;
    const config: IntegrationConfig = JSON.parse(savedConfig);

    if (!config.slackToken || !config.slackChannel) {
        addToast("Slack not configured.", 'error');
        return;
    }
    
    const message = `*Task Update*\n\n` +
                    `*Task:* ${issue.title}\n` +
                    `*Status:* ${issue.status}\n` +
                    `*Link:* ${issue.url || 'N/A'}\n` +
                    `\n_Shared from BugSnap Dashboard_`;
                    
    try {
        await postSlackMessage(config.slackToken, config.slackChannel, message);
        addToast("Task update posted to Slack!", 'success');
    } catch (e) {
         addToast("Failed to post update: " + (e instanceof Error ? e.message : 'Unknown error'), 'error');
    }
  };

  const getPriorityBadge = (priority: ReportedIssue['priority']) => {
    switch (priority) {
      case 'Urgent': return <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-bold border border-red-100"><AlertCircle size={12}/> Urgent</span>;
      case 'High': return <span className="text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-xs font-medium border border-orange-100">High</span>;
      case 'Normal': return <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs font-medium border border-blue-100">Normal</span>;
      case 'Low': return <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-xs font-medium border border-slate-200">Low</span>;
      default: return <span className="text-slate-400 px-2 text-xs">-</span>;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="p-8 max-w-7xl mx-auto w-full">
        
        {/* Header with Quick Actions */}
        <div className="mb-10">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-slate-500">Start a new capture session or track existing bugs.</p>
              </div>
              <div className="flex items-center gap-3">
                  <button 
                      onClick={() => loadData(true)}
                      disabled={isLoading}
                      className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 rounded-lg shadow-sm transition disabled:opacity-70"
                      title="Refresh Data"
                  >
                      <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                  </button>
                  <button 
                      onClick={handleShareDashboardToSlack}
                      className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition shadow-sm"
                  >
                      <Slack size={18} /> Report Status
                  </button>
              </div>
           </div>

           {/* Quick Action Cards */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                onClick={onCapture}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:ring-2 hover:ring-blue-50 transition-all flex items-center gap-4 group text-left"
              >
                 <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <LayoutTemplate size={24} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Floating Snap</h3>
                    <p className="text-xs text-slate-500">Capture any tab/window</p>
                 </div>
              </button>

              <button 
                onClick={onRecord}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-purple-400 hover:ring-2 hover:ring-purple-50 transition-all flex items-center gap-4 group text-left"
              >
                 <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Video size={24} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors">Record Video</h3>
                    <p className="text-xs text-slate-500">Record clip with audio</p>
                 </div>
              </button>

              <button 
                onClick={onUpload}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-400 hover:ring-2 hover:ring-emerald-50 transition-all flex items-center gap-4 group text-left"
              >
                 <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Upload File</h3>
                    <p className="text-xs text-slate-500">Drop images or videos</p>
                 </div>
              </button>
           </div>
        </div>

        {/* Source Switcher */}
        <div className="bg-white rounded-xl p-1 shadow-sm border border-slate-200 inline-flex mb-6">
           <button 
             onClick={() => setActiveSource('ClickUp')}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSource === 'ClickUp' ? 'bg-[#7B68EE] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
           >
              <Layers size={16} /> ClickUp
           </button>
           <button 
             onClick={() => setActiveSource('Jira')}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSource === 'Jira' ? 'bg-[#0052CC] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
           >
              <CreditCard size={16} /> Jira
           </button>
           <button 
             onClick={() => setActiveSource('Slack')}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSource === 'Slack' ? 'bg-[#4A154B] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
           >
              <Slack size={16} /> Slack
           </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex items-start gap-3 text-red-800">
             <AlertTriangle className="shrink-0 mt-0.5" />
             <div>
               <h3 className="font-bold">Connection Issue</h3>
               <p className="text-sm mt-1">{error}</p>
             </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wide">Total Reports</p>
              <p className="text-4xl font-bold text-slate-900 mt-1">{isLoading ? '-' : metrics.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wide">Open Issues</p>
              <p className="text-4xl font-bold text-slate-900 mt-1">{isLoading ? '-' : metrics.openCount}</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <Clock size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wide">Resolution Rate</p>
              <p className="text-4xl font-bold text-slate-900 mt-1">{isLoading ? '-' : `${metrics.resolutionRate}%`}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Donut Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-1 lg:col-span-1 flex flex-col">
            <h3 className="font-bold text-slate-900 mb-6">Status Distribution</h3>
            {metrics.total > 0 ? (
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {metrics.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                  {metrics.chartData.map(m => (
                    <div key={m.status} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.fill }}></div>
                      <span>{m.status} ({m.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 min-h-[200px]">
                 <p>No data available</p>
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 md:col-span-1 lg:col-span-2 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Recent Activity</h3>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                 {activeSource} Data
              </span>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-3 font-bold">Item / Message</th>
                    <th className="px-6 py-3 font-bold">Priority</th>
                    <th className="px-6 py-3 font-bold">Status</th>
                    <th className="px-6 py-3 font-bold">User</th>
                    <th className="px-6 py-3 font-bold">Date</th>
                    <th className="px-6 py-3 font-bold w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {isLoading ? (
                    // Loading Skeletons
                    Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                            <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                        </tr>
                    ))
                  ) : issues.length === 0 && !error ? (
                    <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                           No activity found for {activeSource}.
                        </td>
                    </tr>
                  ) : (
                    issues.map(issue => (
                      <tr key={issue.id} className="hover:bg-slate-50 transition group">
                        <td className="px-6 py-4">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-800 line-clamp-1" title={issue.title}>{issue.title}</span>
                                <span className="font-mono text-xs text-slate-400">#{issue.id.substring(0, 8)}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                          {getPriorityBadge(issue.priority)}
                        </td>
                        <td className="px-6 py-4">
                          <span 
                             className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white capitalize"
                             style={{ backgroundColor: issue.statusColor }}
                          >
                            {issue.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                           {issue.assignee ? (
                             <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs text-slate-600 font-bold">
                                   {issue.assignee.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-slate-600 max-w-[80px] truncate" title={issue.assignee}>{issue.assignee}</span>
                             </div>
                           ) : (
                             <span className="text-slate-400 text-xs italic flex items-center gap-1"><UserCircle size={12}/> Unassigned</span>
                           )}
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col text-xs text-slate-500">
                              <span>{issue.date}</span>
                              {issue.dueDate && (
                                 <span className="text-orange-600 flex items-center gap-1 mt-0.5">
                                    <Calendar size={10} /> Due {issue.dueDate}
                                 </span>
                              )}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {issue.url && (
                                <a 
                                    href={issue.url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-slate-400 hover:text-blue-600 transition p-2 hover:bg-blue-50 rounded-full"
                                    title="Open External"
                                >
                                    <ExternalLink size={16} />
                                </a>
                            )}
                            {/* Share Update Button (Only for active bugs/tasks, not Slack messages) */}
                            {activeSource !== 'Slack' && (
                                <button
                                    onClick={() => handleShareIssueToSlack(issue)}
                                    className="text-slate-400 hover:text-[#4A154B] transition p-2 hover:bg-purple-50 rounded-full"
                                    title="Post Status to Slack"
                                >
                                    <MessageSquare size={16} />
                                </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
