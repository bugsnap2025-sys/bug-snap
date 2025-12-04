import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from './ToastProvider';

interface ScheduledReportingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const ScheduledReportingModal: React.FC<ScheduledReportingModalProps> = ({
    isOpen,
    onClose
}) => {
    const [enabled, setEnabled] = useState(false);
    const [time, setTime] = useState('09:00');
    const [platform, setPlatform] = useState<'Slack' | 'Teams'>('Slack');
    const [daysOfWeek, setDaysOfWeek] = useState([1, 2, 3, 4, 5]); // Mon-Fri
    const [slackWebhook, setSlackWebhook] = useState('');
    const [teamsWebhook, setTeamsWebhook] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            loadConfig();
        }
    }, [isOpen]);

    const loadConfig = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/reports/schedule`);
            if (response.ok) {
                const config = await response.json();
                setEnabled(config.enabled || false);
                setTime(config.time || '09:00');
                setPlatform(config.platform || 'Slack');
                setDaysOfWeek(config.daysOfWeek || [1, 2, 3, 4, 5]);
                setSlackWebhook(config.slackWebhook || '');
                setTeamsWebhook(config.teamsWebhook || '');
            }
        } catch (error) {
            console.error('Failed to load schedule config:', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/reports/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled,
                    time,
                    platform,
                    daysOfWeek,
                    slackWebhook: platform === 'Slack' ? slackWebhook : null,
                    teamsWebhook: platform === 'Teams' ? teamsWebhook : null
                })
            });

            if (response.ok) {
                addToast('Schedule saved successfully', 'success');
                onClose();
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            addToast('Failed to save schedule', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/reports/test`, {
                method: 'POST'
            });

            if (response.ok) {
                addToast('Test report sent!', 'success');
            } else {
                throw new Error('Test failed');
            }
        } catch (error) {
            addToast('Failed to send test report', 'error');
        } finally {
            setIsTesting(false);
        }
    };

    const toggleDay = (day: number) => {
        setDaysOfWeek(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
        );
    };

    const days = [
        { label: 'M', value: 1 },
        { label: 'T', value: 2 },
        { label: 'W', value: 3 },
        { label: 'T', value: 4 },
        { label: 'F', value: 5 },
        { label: 'S', value: 6 },
        { label: 'S', value: 0 }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#272727]">
                <div className="p-4 flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <Calendar size={20} />
                        <span>Scheduled Reporting</span>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                        Automate daily summaries
                    </p>

                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#272727] rounded-lg">
                        <span className="font-bold text-slate-900 dark:text-white">Enable Auto-Report</span>
                        <button
                            onClick={() => setEnabled(!enabled)}
                            className={`w-12 h-6 rounded-full transition ${enabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-[#444]'
                                }`}
                        >
                            <div
                                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition ${enabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Send Time */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">
                            Send Time
                        </label>
                        <div className="relative">
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg p-3 pr-10 text-slate-900 dark:text-white outline-none"
                            />
                            <Clock className="absolute right-3 top-3.5 text-slate-400" size={18} />
                        </div>
                    </div>

                    {/* Platform */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">
                            Platform
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPlatform('Slack')}
                                className={`p-3 rounded-lg border-2 font-bold transition ${platform === 'Slack'
                                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                                        : 'border-slate-200 dark:border-[#333] text-slate-600 dark:text-zinc-400'
                                    }`}
                            >
                                Slack
                            </button>
                            <button
                                onClick={() => setPlatform('Teams')}
                                className={`p-3 rounded-lg border-2 font-bold transition ${platform === 'Teams'
                                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                                        : 'border-slate-200 dark:border-[#333] text-slate-600 dark:text-zinc-400'
                                    }`}
                            >
                                Teams
                            </button>
                        </div>
                    </div>

                    {/* Webhook URL */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">
                            {platform} Webhook URL
                        </label>
                        <input
                            type="text"
                            placeholder={`https://hooks.${platform.toLowerCase()}.com/...`}
                            value={platform === 'Slack' ? slackWebhook : teamsWebhook}
                            onChange={(e) =>
                                platform === 'Slack'
                                    ? setSlackWebhook(e.target.value)
                                    : setTeamsWebhook(e.target.value)
                            }
                            className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg p-3 text-sm font-mono text-slate-900 dark:text-white outline-none"
                        />
                    </div>

                    {/* Days of Week */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">
                            Days of Week
                        </label>
                        <div className="flex gap-2">
                            {days.map((day) => (
                                <button
                                    key={day.value}
                                    onClick={() => toggleDay(day.value)}
                                    className={`w-10 h-10 rounded-lg font-bold transition ${daysOfWeek.includes(day.value)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 dark:bg-[#333] text-slate-400 dark:text-zinc-500'
                                        }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Note */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            <strong>Note:</strong> Reports are generated on the backend. Make sure your backend server is running.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleTest}
                            disabled={isTesting || !enabled}
                            className="flex-1 py-2 bg-slate-100 dark:bg-[#333] hover:bg-slate-200 dark:hover:bg-[#444] text-slate-700 dark:text-zinc-200 font-bold rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Test Now
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Save Schedule
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
