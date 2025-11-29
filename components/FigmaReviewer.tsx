import React, { useState, useEffect } from 'react';
import { Slide } from '../types';
import { getFigmaImage, downloadFigmaImageAsDataUrl, getFigmaFrames, FigmaNode } from '../services/figmaService';
import { compareWithFigma } from '../services/figmaComparisonService';
import { useToast } from './ToastProvider';
import { 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Sparkles,
  ExternalLink,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface FigmaReviewerProps {
  slide: Slide;
  isOpen: boolean;
  onClose: () => void;
  onOpenIntegrations?: () => void;
}

interface ComparisonResult {
  matchScore: number;
  improvements: Array<{
    category: string;
    severity: 'critical' | 'major' | 'minor';
    description: string;
    suggestion: string;
  }>;
  summary: string;
  detailedAnalysis: string;
}

export const FigmaReviewer: React.FC<FigmaReviewerProps> = ({ slide, isOpen, onClose, onOpenIntegrations }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFrames, setIsLoadingFrames] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [figmaFrames, setFigmaFrames] = useState<FigmaNode[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [figmaImageUrl, setFigmaImageUrl] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { addToast } = useToast();

  // Load Figma configuration
  const getFigmaConfig = () => {
    const saved = localStorage.getItem('bugsnap_config');
    if (!saved) return null;
    const config = JSON.parse(saved);
    if (!config.figmaToken || !config.figmaFileKey) return null;
    return {
      token: config.figmaToken,
      fileKey: config.figmaFileKey,
      nodeId: config.figmaNodeId || null
    };
  };

  // Load frames when modal opens
  useEffect(() => {
    if (isOpen) {
      const config = getFigmaConfig();
      if (config?.nodeId) {
        setSelectedFrameId(config.nodeId);
      } else {
        setSelectedFrameId(null);
      }
      loadFigmaFrames();
    } else {
      setResult(null);
      setError(null);
      setFigmaFrames([]);
      setFigmaImageUrl(null);
      setSelectedFrameId(null);
    }
  }, [isOpen]);

  const loadFigmaFrames = async () => {
    const config = getFigmaConfig();
    if (!config) {
      setError('Please configure Figma in Integrations settings first.');
      setIsLoadingFrames(false);
      return;
    }

    setIsLoadingFrames(true);
    setError(null);
    try {
      const frames = await getFigmaFrames(config.fileKey, config.token);
      console.log('Loaded Figma frames:', frames.length);
      setFigmaFrames(frames);
      if (frames.length > 0 && !selectedFrameId) {
        setSelectedFrameId(frames[0].id);
      } else if (frames.length === 0) {
        setError('No frames found in this Figma file. Make sure the file contains frames, components, or instances.');
      }
    } catch (err) {
      console.error('Error loading Figma frames:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load Figma frames';
      setError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setIsLoadingFrames(false);
    }
  };

  const handleCompare = async () => {
    const config = getFigmaConfig();
    if (!config) {
      setError('Please configure Figma in Integrations settings first.');
      return;
    }

    if (!selectedFrameId) {
      setError('Please select a Figma frame to compare.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Get screenshot as data URL
      const screenshotDataUrl = await getScreenshotDataUrl();

      // Get Figma image
      const figmaImageUrl = await getFigmaImage(config.fileKey, selectedFrameId, config.token);
      const figmaDataUrl = await downloadFigmaImageAsDataUrl(figmaImageUrl);
      setFigmaImageUrl(figmaDataUrl);

      // Compare using AI
      const comparison = await compareWithFigma(screenshotDataUrl, figmaDataUrl);
      setResult(comparison);
      addToast('Comparison completed!', 'success');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to compare with Figma design';
      setError(errorMsg);
      addToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getScreenshotDataUrl = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load screenshot'));
      img.src = slide.src;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800';
      case 'major': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800';
      case 'minor': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const config = getFigmaConfig();
  const hasConfig = !!config;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-[#272727]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-[#272727]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Figma Design Review</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">AI-powered design comparison</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasConfig ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 dark:bg-[#272727] rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Figma Not Configured</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                Please configure your Figma token and file in Integrations settings.
              </p>
              <div className="flex flex-col gap-3">
                {onOpenIntegrations && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenIntegrations();
                    }}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                  >
                    Open Integrations Settings
                  </button>
                )}
                <a
                  href="https://www.figma.com/developers/api#access-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full px-4 py-2 bg-slate-100 dark:bg-[#272727] hover:bg-slate-200 dark:hover:bg-[#333] text-slate-700 dark:text-zinc-300 font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  Get Figma Token <ExternalLink size={16} />
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Frame Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-2">
                  Select Figma Frame to Compare
                </label>
                {isLoadingFrames ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Loading frames...</span>
                  </div>
                ) : (
                  <select
                    value={selectedFrameId || ''}
                    onChange={(e) => setSelectedFrameId(e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#3f3f3f] rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a frame...</option>
                    {figmaFrames.map((frame) => (
                      <option key={frame.id} value={frame.id}>
                        {frame.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Compare Button */}
              <button
                onClick={handleCompare}
                disabled={isLoading || !selectedFrameId}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>Compare with Figma Design</span>
                  </>
                )}
              </button>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-900 dark:text-red-200">Error</p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-6">
                  {/* Match Score */}
                  <div className={`p-6 rounded-xl border-2 ${getScoreBgColor(result.matchScore)} border-current ${getScoreColor(result.matchScore)}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-semibold opacity-80">Design Match Score</p>
                        <p className="text-4xl font-extrabold mt-1">{result.matchScore}%</p>
                      </div>
                      {result.matchScore >= 80 ? (
                        <CheckCircle2 size={48} className="opacity-60" />
                      ) : (
                        <AlertTriangle size={48} className="opacity-60" />
                      )}
                    </div>
                    <div className="w-full bg-white/50 dark:bg-black/20 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${getScoreColor(result.matchScore).replace('text-', 'bg-')}`}
                        style={{ width: `${result.matchScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Summary</p>
                        <p className="text-sm text-blue-800 dark:text-blue-300">{result.summary}</p>
                      </div>
                    </div>
                  </div>

                  {/* Improvements */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                      Improvement Suggestions ({result.improvements.length})
                    </h3>
                    <div className="space-y-3">
                      {result.improvements.map((improvement, index) => {
                        const categoryKey = improvement.category;
                        const isExpanded = expandedCategories.has(categoryKey);
                        const categoryItems = result.improvements.filter(i => i.category === categoryKey);

                        return (
                          <div key={index} className="border border-slate-200 dark:border-[#3f3f3f] rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleCategory(categoryKey)}
                              className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-[#0f0f0f] hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 text-xs font-bold rounded border ${getSeverityColor(improvement.severity)}`}>
                                  {improvement.severity.toUpperCase()}
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white">{improvement.category}</span>
                                <span className="text-xs text-slate-500 dark:text-zinc-400">
                                  ({categoryItems.length} issue{categoryItems.length !== 1 ? 's' : ''})
                                </span>
                              </div>
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            {isExpanded && (
                              <div className="p-4 space-y-3 bg-white dark:bg-[#1e1e1e]">
                                {categoryItems.map((item, itemIndex) => (
                                  <div key={itemIndex} className="pl-4 border-l-2 border-slate-200 dark:border-[#3f3f3f]">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                      {item.description}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-zinc-400 italic">
                                      💡 {item.suggestion}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detailed Analysis */}
                  {result.detailedAnalysis && (
                    <div className="p-4 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#3f3f3f] rounded-lg">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Detailed Analysis</h4>
                      <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                        {result.detailedAnalysis}
                      </p>
                    </div>
                  )}

                  {/* Side-by-side comparison images */}
                  {figmaImageUrl && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2">Figma Design</p>
                        <img src={figmaImageUrl} alt="Figma Design" className="w-full rounded-lg border border-slate-200 dark:border-[#3f3f3f]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2">Your Implementation</p>
                        <img src={slide.src} alt="Screenshot" className="w-full rounded-lg border border-slate-200 dark:border-[#3f3f3f]" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

