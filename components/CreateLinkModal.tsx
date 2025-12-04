import React, { useState } from 'react';
import { X, Link as LinkIcon, Copy, Loader2, CheckCircle2, FileText, Image as ImageIcon } from 'lucide-react';
import { useToast } from './ToastProvider';

interface CreateLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateLink: (mode: 'current' | 'all') => Promise<string>;
}

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({
    isOpen,
    onClose,
    onCreateLink
}) => {
    const [mode, setMode] = useState<'current' | 'all'>('current');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const { addToast } = useToast();

    if (!isOpen) return null;

    const handleCreate = async () => {
        setIsLoading(true);
        setGeneratedLink(null);
        try {
            const link = await onCreateLink(mode);
            setGeneratedLink(link);
            addToast("Link created successfully!", "success");
        } catch (error: any) {
            console.error(error);
            addToast(error.message || "Failed to create link", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            addToast("Link copied to clipboard", "success");
        }
    };

    const handleClose = () => {
        setGeneratedLink(null);
        setIsLoading(false);
        onClose();
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#272727] transition-colors">
                <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-[#272727]">
                    <div className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white">
                        <LinkIcon size={20} className="text-blue-600 dark:text-blue-400" />
                        <span>Create Public Link</span>
                    </div>
                    <button onClick={handleClose} className="hover:bg-slate-100 dark:hover:bg-[#333] p-1 rounded transition text-slate-500 dark:text-zinc-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!generatedLink ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setMode('current')}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${mode === 'current' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-[#333] hover:border-blue-300 dark:hover:border-blue-700 text-slate-600 dark:text-zinc-400'}`}
                                >
                                    <ImageIcon size={32} />
                                    <span className="font-bold text-sm">Current Slide</span>
                                </button>
                                <button
                                    onClick={() => setMode('all')}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${mode === 'all' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-[#333] hover:border-blue-300 dark:hover:border-blue-700 text-slate-600 dark:text-zinc-400'}`}
                                >
                                    <FileText size={32} />
                                    <span className="font-bold text-sm">All Slides (PDF)</span>
                                </button>
                            </div>

                            <div className="bg-slate-50 dark:bg-[#272727] p-4 rounded-lg text-xs text-slate-500 dark:text-zinc-400">
                                <p>
                                    This will upload the file to your Google Drive and generate a public view-only link.
                                    Anyone with the link can view it.
                                </p>
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={isLoading}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <LinkIcon size={18} />}
                                {isLoading ? 'Creating Link...' : 'Generate Link'}
                            </button>
                        </>
                    ) : (
                        <div className="space-y-4 animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col items-center justify-center text-center mb-6">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-3">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Link Ready!</h3>
                                <p className="text-slate-500 dark:text-zinc-400 text-sm">Your file has been uploaded successfully.</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={generatedLink}
                                    className="flex-1 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#3f3f3f] rounded-lg p-3 text-sm font-mono text-slate-600 dark:text-zinc-300 outline-none"
                                />
                                <button
                                    onClick={handleCopy}
                                    className="p-3 bg-slate-100 dark:bg-[#333] hover:bg-slate-200 dark:hover:bg-[#444] text-slate-700 dark:text-zinc-200 rounded-lg transition"
                                    title="Copy to Clipboard"
                                >
                                    <Copy size={18} />
                                </button>
                            </div>

                            <button
                                onClick={handleClose}
                                className="w-full py-2 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-white font-medium text-sm transition"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
