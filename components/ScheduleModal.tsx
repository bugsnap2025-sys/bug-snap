
import React, { useState, useEffect } from 'react';
import { IntegrationConfig, ReportedIssue } from '../types';
import { X, CalendarClock, Check, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { useToast } from './ToastProvider';
import { fetchClickUpTasks, getAllClickUpLists } from '../services/clickUpService';
import { fetchJiraIssues } from '../services/jiraService';
import { generateDashboardSummary, postSlackMessage } from '../services/slackService';
import { postTeamsMessage } from '../services/teamsService';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: IntegrationConfig;
  onSave: (config: IntegrationConfig) => void;
}

const DAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' },
];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, currentConfig, onSave }) => {
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [platform, setPlatform] = useState<'Slack' | 'Teams'>('Slack');
  const [isTesting, setIsTesting] = useState(false);
  
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setEnabled(currentConfig.scheduleEnabled || false);
      setTime(currentConfig.scheduleTime || '09:00');
      setSelectedDays(currentConfig.scheduleDays || [1, 2, 3, 4, 5]); // Default Mon-Fri
      setPlatform(currentConfig.schedulePlatform || 'Slack');
    }
  }, [isOpen, currentConfig]);

  const toggleDay = (dayId: number) => {
    setSelectedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(d => d !== dayId) 
        : [...prev, dayId]
    );
  };

  const handleSave = () => {
    onSave({
      ...currentConfig,
      scheduleEnabled: enabled,
      scheduleTime: time,
      scheduleDays: selectedDays,
      schedulePlatform: platform
    });
    onClose();
  };

  const handleTestRun = async () => {
      setIsTesting(true);
      try {
          // 1. Fetch Data
          let issues: ReportedIssue[] = [];
          let sourceFound = false;

          // Attempt ClickUp
          if (currentConfig.clickUpToken) {
              let targetListId = currentConfig.clickUpListId;
              
              // If no list is selected in config (e.g. fresh integration), try to fetch the first available list
              if (!targetListId) {
                  try {
                      const lists = await getAllClickUpLists(currentConfig.clickUpToken);
                      if (lists.length > 0) {
                          targetListId = lists[0].id;
                      }
                  } catch (e) {
                      console.error("Auto-discovery of ClickUp list failed", e);
                  }
              }

              if (targetListId) {
                  sourceFound = true;
                  issues = await fetchClickUpTasks(targetListId, currentConfig.clickUpToken);
              }
          } 
          
          // Attempt Jira (if ClickUp didn't yield a valid source configuration or as fallback)
          if (!sourceFound && currentConfig.jiraUrl && currentConfig.jiraToken && currentConfig.jiraEmail) {
              sourceFound = true;
              issues = await fetchJiraIssues({ domain: currentConfig.jiraUrl, email: currentConfig.jiraEmail, token: currentConfig.jiraToken });
          }

          if (!sourceFound) {
              if (currentConfig.clickUpToken && !currentConfig.clickUpListId) {
                  addToast("ClickUp is connected but no List could be found. Please check your ClickUp permissions or select a list in the Dashboard.", "error");
              } else {
                  addToast("No source configured (ClickUp or Jira). Please set up integrations.", "error");
              }
              setIsTesting(false);
              return;
          }

          // 2. Metrics
          const total = issues.length;
          const resolvedStatuses = ['complete', 'closed', 'resolved', 'done', 'completed'];
          const resolvedCount = issues.filter(i => resolvedStatuses.includes(i.status.toLowerCase())).length;
          const openCount = total - resolvedCount;
          const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;
          const priorityDist = { Urgent: 0, High: 0, Normal: 0, Low: 0 };
          issues.forEach(i => { if (priorityDist[i.priority as keyof typeof priorityDist] !== undefined) priorityDist[i.priority as keyof typeof priorityDist]++; });
          const priorityData = Object.keys(priorityDist).map(k => ({ name: k, count: priorityDist[k as keyof typeof priorityDist] }));
          
          const metrics = { total, openCount, resolvedCount, resolutionRate, priorityData };

          // 3. Send
          if (platform === 'Slack') {
              if (!currentConfig.slackToken || !currentConfig.slackChannel) {
                  addToast("Slack not configured. Check Integrations.", "error");
                  return;
              }
              const summary = generateDashboardSummary(metrics);
              await postSlackMessage(currentConfig.slackToken, currentConfig.slackChannel, summary);
              addToast("Test report sent to Slack!", 'success');
          } 
          else if (platform === 'Teams') {
              if (!currentConfig.teamsWebhookUrl) {
                  addToast("Teams not configured. Check Integrations.", "error");
                  return;
              }
              const priorityText = (priorityData || []).map((p: any) => `- **${p.name}**: ${p.count}`).join('\n');
              const summary = `**BugSnap Daily Report**\n\n` +
                     `✅ **Resolved:** ${resolvedCount}\n\n` +
                     `⏳ **Pending:** ${openCount}\n\n` +
                     `**Priority:**\n${priorityText || 'No active issues'}`;
              await postTeamsMessage(currentConfig.teamsWebhookUrl, undefined, summary);
              addToast("Test report sent to Teams!", 'success');
          }

      } catch (e) {
          console.error(e);
          const msg = e instanceof Error ? e.message : "Test failed";
          addToast(msg, 'error');
      } finally {
          setIsTesting(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#272727] flex flex-col transition-colors">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-[#272727] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <CalendarClock size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Scheduled Reporting</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Automate daily summaries</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#272727] transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Toggle Enable */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#3f3f3f]">
            <span className="font-bold text-slate-700 dark:text-zinc-200">Enable Auto-Report</span>
            <button 
              onClick={() => setEnabled(!enabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${enabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-[#333]'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${enabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className={`space-y-6 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            
            {/* Time Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Send Time</label>
              <input 
                type="time" 
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Platform</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setPlatform('Slack')}
                  className={`p-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${platform === 'Slack' ? 'border-[#4A154B] bg-[#4A154B]/10 text-[#4A154B] dark:text-[#E01E5A]' : 'border-slate-200 dark:border-[#3f3f3f] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#222]'}`}
                >
                  Slack
                </button>
                <button 
                  onClick={() => setPlatform('Teams')}
                  className={`p-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${platform === 'Teams' ? 'border-[#5059C9] bg-[#5059C9]/10 text-[#5059C9] dark:text-[#6264A7]' : 'border-slate-200 dark:border-[#3f3f3f] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#222]'}`}
                >
                  Teams
                </button>
              </div>
            </div>

            {/* Days Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Days of Week</label>
              <div className="flex justify-between gap-1">
                {DAYS.map(day => (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    className={`
                      w-10 h-10 rounded-lg text-xs font-bold transition-all flex items-center justify-center
                      ${selectedDays.includes(day.id) 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' 
                        : 'bg-slate-100 dark:bg-[#272727] text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-[#333]'
                      }
                    `}
                  >
                    {day.label.charAt(0)}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg flex gap-3 border border-amber-100 dark:border-amber-900/30">
               <AlertCircle size={16} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5"/>
               <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                 <strong>Note:</strong> Reports are generated in your browser. If this tab is closed at the scheduled time, the report will be sent automatically the next time you open the app on that day.
               </p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-[#272727] bg-slate-50 dark:bg-[#0f0f0f] flex justify-between gap-3">
          <button 
            onClick={handleTestRun}
            disabled={isTesting || !enabled}
            className="px-4 py-2.5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-200 dark:hover:bg-blue-900/40 rounded-xl transition text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isTesting ? <RefreshCw size={16} className="animate-spin"/> : <Send size={16}/>}
            Test Now
          </button>
          
          <div className="flex gap-2">
              <button onClick={onClose} className="px-6 py-2.5 text-slate-600 dark:text-zinc-400 font-bold hover:bg-slate-200 dark:hover:bg-[#272727] rounded-xl transition text-sm">
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 text-sm"
              >
                <Check size={18} />
                Save Schedule
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};
