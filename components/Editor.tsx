
import React, { useState, useRef, useEffect } from 'react';
import { Slide, Annotation, ToolType, Point, ClickUpExportMode, SlackExportMode, IntegrationConfig, IntegrationSource } from '../types';
import { refineBugReport } from '../services/geminiService';
import { createClickUpTask, uploadClickUpAttachment, generateTaskDescription, generateMasterDescription } from '../services/clickUpService';
import { postSlackMessage, uploadSlackFile, generateSlideMessage } from '../services/slackService';
import { ClickUpModal } from './ClickUpModal';
import { SlackModal } from './SlackModal';
import { IntegrationModal } from './IntegrationModal';
import { useToast } from './ToastProvider';
import { jsPDF } from "jspdf";
import { 
  Square, 
  Circle as CircleIcon, 
  MousePointer2, 
  Wand2, 
  Trash2, 
  FileText, 
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Plus,
  Layers,
  ClipboardCopy,
  Camera,
  Video,
  Upload,
  X,
  Move,
  AlertTriangle,
  Check,
  ExternalLink
} from 'lucide-react';

interface EditorProps {
  slides: Slide[];
  activeSlideId: string;
  onSelectSlide: (id: string) => void;
  onUpdateSlide: (updatedSlide: Slide) => void;
  onDeleteSlide: (id: string) => void;
  onAddSlide: () => void; // This triggers file upload
  onCaptureScreen: () => void;
  onRecordVideo: () => void;
  onClose: () => void;
}

export const Editor: React.FC<EditorProps> = ({ 
  slides, 
  activeSlideId, 
  onSelectSlide, 
  onUpdateSlide, 
  onDeleteSlide,
  onAddSlide,
  onCaptureScreen,
  onRecordVideo,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const commentRefs = useRef<{ [key: number]: HTMLTextAreaElement | null }>({});
  const { addToast } = useToast();
  
  // Derived state
  const activeSlide = slides.find(s => s.id === activeSlideId) || slides[0];
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  
  // UI State
  const [selectedTool, setSelectedTool] = useState<ToolType>(ToolType.RECTANGLE);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  
  // Interaction State
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  
  // Modal State
  const [isClickUpModalOpen, setIsClickUpModalOpen] = useState(false);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [createdTaskUrl, setCreatedTaskUrl] = useState<string | null>(null);
  
  // Integration Modal State
  const [integrationModalSource, setIntegrationModalSource] = useState<IntegrationSource | null>(null);

  // Update local annotations when active slide changes
  useEffect(() => {
    if (activeSlide) {
      setAnnotations(activeSlide.annotations);
      setSelectedAnnotationId(null);
      setStartPoint(null);
      setCurrentPoint(null);
      setIsDrawing(false);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [activeSlideId, slides]);

  // Auto-focus new annotation comment
  useEffect(() => {
     if (annotations.length > 0) {
         const lastId = annotations[annotations.length - 1].id;
         // Only focus if it's the one we just selected (created)
         if (selectedAnnotationId === lastId && commentRefs.current[lastId]) {
             commentRefs.current[lastId]?.focus();
         }
     }
  }, [annotations.length]);

  // Click outside listener for Add Menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isAddMenuOpen && addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddMenuOpen]);


  // --- Canvas Logic ---
  const getCanvasPoint = (e: React.MouseEvent): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    };
  };

  const getResizeHandle = (point: Point, ann: Annotation): string | null => {
      const handleSize = 10;
      const minX = Math.min(ann.start.x, ann.end.x);
      const minY = Math.min(ann.start.y, ann.end.y);
      const maxX = Math.max(ann.start.x, ann.end.x);
      const maxY = Math.max(ann.start.y, ann.end.y);

      if (Math.abs(point.x - minX) < handleSize && Math.abs(point.y - minY) < handleSize) return 'tl';
      if (Math.abs(point.x - maxX) < handleSize && Math.abs(point.y - minY) < handleSize) return 'tr';
      if (Math.abs(point.x - minX) < handleSize && Math.abs(point.y - maxY) < handleSize) return 'bl';
      if (Math.abs(point.x - maxX) < handleSize && Math.abs(point.y - maxY) < handleSize) return 'br';
      
      return null;
  };

  const isPointInAnnotation = (point: Point, ann: Annotation): boolean => {
      const minX = Math.min(ann.start.x, ann.end.x);
      const minY = Math.min(ann.start.y, ann.end.y);
      const maxX = Math.max(ann.start.x, ann.end.x);
      const maxY = Math.max(ann.start.y, ann.end.y);
      
      return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const point = getCanvasPoint(e);

    // 1. Check Resize Handle
    if (selectedAnnotationId) {
        const ann = annotations.find(a => a.id === selectedAnnotationId);
        if (ann) {
            const handle = getResizeHandle(point, ann);
            if (handle) {
                setResizeHandle(handle);
                setIsDrawing(true);
                return;
            }
        }
    }

    // 2. Check for Dragging Existing Annotation
    if (selectedTool === ToolType.SELECT) {
        // Check if we clicked on the selected annotation first
        const selectedAnn = annotations.find(a => a.id === selectedAnnotationId);
        if (selectedAnn && isPointInAnnotation(point, selectedAnn)) {
            setIsDraggingShape(true);
            setDragOffset({ x: point.x - selectedAnn.start.x, y: point.y - selectedAnn.start.y }); // Offset from start point
            // For simplicity, tracking offset from start point. 
            // Better: track mouse delta.
            setStartPoint(point); // Use this to calc delta
            return;
        }

        // Check if clicked on any other annotation
        const clickedAnn = annotations.find(a => isPointInAnnotation(point, a));
        if (clickedAnn) {
            setSelectedAnnotationId(clickedAnn.id);
            setIsDraggingShape(true);
            setStartPoint(point);
            return;
        }
        
        // If clicked on empty space, deselect
        setSelectedAnnotationId(null);
        return;
    }
    
    // 3. Start Drawing New Shape
    setStartPoint(point);
    setCurrentPoint(point);
    setIsDrawing(true);
    setSelectedAnnotationId(null);
    setResizeHandle(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const point = getCanvasPoint(e);
    
    if (isDraggingShape && selectedAnnotationId && startPoint) {
        // Move logic
        const dx = point.x - startPoint.x;
        const dy = point.y - startPoint.y;
        
        setAnnotations(prev => prev.map(ann => {
            if (ann.id === selectedAnnotationId) {
                return {
                    ...ann,
                    start: { x: ann.start.x + dx, y: ann.start.y + dy },
                    end: { x: ann.end.x + dx, y: ann.end.y + dy }
                };
            }
            return ann;
        }));
        setStartPoint(point); // Reset start to current for next delta
        return;
    }

    if (!isDrawing) return;
    
    if (resizeHandle && selectedAnnotationId) {
        const updatedAnnotations = annotations.map(ann => {
            if (ann.id === selectedAnnotationId) {
                const newAnn = { ...ann };
                if (resizeHandle === 'tl') newAnn.start = point;
                else if (resizeHandle === 'br') newAnn.end = point;
                else if (resizeHandle === 'tr') { newAnn.end.x = point.x; newAnn.start.y = point.y; }
                else if (resizeHandle === 'bl') { newAnn.start.x = point.x; newAnn.end.y = point.y; }
                return newAnn;
            }
            return ann;
        });
        setAnnotations(updatedAnnotations);
        return;
    }

    setCurrentPoint(point);
  };

  const handleMouseUp = () => {
    if (isDraggingShape) {
        onUpdateSlide({ ...activeSlide, annotations });
        setIsDraggingShape(false);
        setStartPoint(null);
        return;
    }

    if (!isDrawing) return;
    
    if (resizeHandle && selectedAnnotationId) {
        onUpdateSlide({ ...activeSlide, annotations });
        setResizeHandle(null);
        setIsDrawing(false);
        return;
    }

    if (!startPoint || !currentPoint) return;
    
    if (Math.abs(currentPoint.x - startPoint.x) < 5 && Math.abs(currentPoint.y - startPoint.y) < 5) {
      setIsDrawing(false);
      return;
    }

    const newAnnotation: Annotation = {
      id: Date.now(),
      type: selectedTool,
      start: startPoint,
      end: currentPoint,
      comment: '',
      color: '#ef4444', 
      timestamp: activeSlide.type === 'video' ? currentTime : undefined
    };

    const updatedAnnotations = [...annotations, newAnnotation];
    setAnnotations(updatedAnnotations);
    onUpdateSlide({ ...activeSlide, annotations: updatedAnnotations });
    setSelectedAnnotationId(newAnnotation.id);
    setIsDrawing(false);
  };

  // --- Actions ---
  const handleUndo = () => {
    if (annotations.length === 0) return;
    const updated = annotations.slice(0, -1);
    setAnnotations(updated);
    onUpdateSlide({ ...activeSlide, annotations: updated });
  };

  const handleDeleteSelected = () => {
    if (selectedAnnotationId) {
      const updated = annotations.filter(a => a.id !== selectedAnnotationId);
      setAnnotations(updated);
      onUpdateSlide({ ...activeSlide, annotations: updated });
      setSelectedAnnotationId(null);
    }
  };

  const handleCommentChange = (id: number, text: string) => {
    const updated = annotations.map(a => a.id === id ? { ...a, comment: text } : a);
    setAnnotations(updated);
    onUpdateSlide({ ...activeSlide, annotations: updated });
  };

  const handleAiRefine = async (id: number) => {
    const annotation = annotations.find(a => a.id === id);
    if (!annotation || !annotation.comment) return;
    setAiLoadingId(id);
    const refinedText = await refineBugReport(annotation.comment);
    handleCommentChange(id, refinedText);
    setAiLoadingId(null);
    addToast('Text refined with AI', 'success');
  };

  const handleNextSlide = () => {
    const idx = slides.findIndex(s => s.id === activeSlideId);
    if (idx < slides.length - 1) onSelectSlide(slides[idx + 1].id);
  };

  const handlePrevSlide = () => {
    const idx = slides.findIndex(s => s.id === activeSlideId);
    if (idx > 0) onSelectSlide(slides[idx - 1].id);
  };

  const handleSaveIntegration = (newConfig: IntegrationConfig) => {
      const saved = localStorage.getItem('bugsnap_config');
      const current = saved ? JSON.parse(saved) : {};
      const updated = { ...current, ...newConfig };
      localStorage.setItem('bugsnap_config', JSON.stringify(updated));
      
      addToast(`${integrationModalSource} connected!`, 'success');
      setIntegrationModalSource(null);
  };

  // --- Export Logic ---

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  }

  const generateCompositeImage = async (slide: Slide): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas creation failed");

    let naturalWidth = 0;
    let naturalHeight = 0;
    let displayWidth = 0;
    let source: CanvasImageSource;
    let videoTime = 0;

    if (activeSlideId === slide.id && mediaRef.current) {
        const el = mediaRef.current;
        if (slide.type === 'video') {
            const v = el as HTMLVideoElement;
            naturalWidth = v.videoWidth;
            naturalHeight = v.videoHeight;
            displayWidth = v.clientWidth;
            source = v;
            videoTime = v.currentTime;
        } else {
            const img = el as HTMLImageElement;
            naturalWidth = img.naturalWidth;
            naturalHeight = img.naturalHeight;
            displayWidth = img.clientWidth;
            source = img;
        }
    } else {
        if (slide.type === 'video') {
             const res = await fetch(slide.src);
             return await res.blob();
        }
        await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.src = slide.src;
            img.crossOrigin = "anonymous";
            img.onload = () => {
                naturalWidth = img.naturalWidth;
                naturalHeight = img.naturalHeight;
                const estimatedHeight = 800; 
                displayWidth = naturalWidth * (estimatedHeight / naturalHeight);
                source = img;
                resolve();
            };
            img.onerror = reject;
        });
    }

    const scale = naturalWidth / displayWidth;
    const sidebarWidth = 600; 
    const totalWidth = naturalWidth + sidebarWidth;
    const totalHeight = Math.max(naturalHeight, 900);

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalWidth, totalHeight);
    
    // @ts-ignore
    ctx.drawImage(source, 0, 0, naturalWidth, naturalHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(naturalWidth, 0, sidebarWidth, totalHeight);

    ctx.beginPath();
    ctx.moveTo(naturalWidth, 0);
    ctx.lineTo(naturalWidth, totalHeight);
    ctx.strokeStyle = '#cbd5e1'; 
    ctx.lineWidth = 2;
    ctx.stroke();

    const contentX = naturalWidth + 50;
    let currentY = 80;

    ctx.fillStyle = '#0f172a'; 
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Issue Report', contentX, currentY);
    currentY += 60;

    ctx.fillStyle = '#64748b'; 
    ctx.font = '24px sans-serif';
    ctx.fillText(`Generated on ${new Date(slide.createdAt).toLocaleDateString()}`, contentX, currentY);
    currentY += 60;

    ctx.beginPath();
    ctx.moveTo(contentX, currentY);
    ctx.lineTo(totalWidth - 50, currentY);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();
    currentY += 50;

    ctx.textBaseline = 'top';

    slide.annotations.forEach((ann, i) => {
        const isFrameMatch = slide.type !== 'video' || Math.abs((ann.timestamp || 0) - videoTime) < 0.5;
        
        if (isFrameMatch) {
            const sx = ann.start.x * scale;
            const sy = ann.start.y * scale;
            const ex = ann.end.x * scale;
            const ey = ann.end.y * scale;
            const w = Math.abs(ex - sx);
            const h = Math.abs(ey - sy);
            const x = Math.min(sx, ex);
            const y = Math.min(sy, ey);

            ctx.strokeStyle = ann.color;
            ctx.lineWidth = 3 * scale; 
            ctx.fillStyle = hexToRgba(ann.color, 0.2); 

            if (ann.type === ToolType.RECTANGLE) {
                ctx.fillRect(x, y, w, h);
                ctx.strokeRect(x, y, w, h);
            } else if (ann.type === ToolType.CIRCLE) {
                ctx.beginPath();
                ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            }

            const badgeR = 16 * scale;
            ctx.beginPath();
            ctx.arc(x, y, badgeR, 0, 2 * Math.PI);
            ctx.fillStyle = ann.color;
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = `bold ${18 * scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((i + 1).toString(), x, y);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const badgeRadius = 20;
        ctx.beginPath();
        ctx.arc(contentX + badgeRadius, currentY + badgeRadius, badgeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = ann.color;
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((i + 1).toString(), contentX + badgeRadius, currentY + badgeRadius);

        const textX = contentX + (badgeRadius * 2) + 20;
        const textWidth = (totalWidth - 50) - textX;
        ctx.fillStyle = '#334155'; 
        ctx.font = '24px sans-serif'; 
        ctx.textAlign = 'left';
        
        const text = ann.comment || "No description provided.";
        const nextY = wrapText(ctx, text, textX, currentY + 5, textWidth, 36);
        
        currentY = Math.max(nextY, currentY + 60) + 30; 
    });

    return new Promise((resolve) => {
        canvas.toBlob(blob => resolve(blob!), 'image/png');
    });
  };

  const handleGeneratePDF = async () => {
    setIsProcessing(true);
    addToast("Generating PDF...", "info");
    
    try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        for (let i = 0; i < slides.length; i++) {
            if (i > 0) doc.addPage();
            const blob = await generateCompositeImage(slides[i]);
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });

            const imgProps = doc.getImageProperties(base64);
            const imgRatio = imgProps.width / imgProps.height;
            let w = pageWidth;
            let h = pageWidth / imgRatio;
            if (h > pageHeight) { h = pageHeight; w = pageHeight * imgRatio; }
            const x = (pageWidth - w) / 2;
            const y = (pageHeight - h) / 2;
            doc.addImage(base64, 'PNG', x, y, w, h);
        }
        doc.save(`BugSnap_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        addToast("PDF Downloaded Successfully", "success");
    } catch (err) {
        addToast("Failed to generate PDF", "error");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCopySlide = async () => {
    setIsProcessing(true);
    try {
        const blob = await generateCompositeImage(activeSlide);
        if (navigator.clipboard && navigator.clipboard.write) {
             await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
             addToast("Slide image copied to clipboard!", "success");
        } else {
            throw new Error("Clipboard API not supported");
        }
    } catch (err) {
        addToast("Failed to copy image. Try using Chrome.", "error");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCopyAllText = () => {
     setIsProcessing(true);
     try {
         const summary = generateMasterDescription(slides);
         navigator.clipboard.writeText(summary);
         addToast("Full report summary copied to clipboard!", "success");
     } catch (err) {
         addToast("Failed to copy text", "error");
     } finally {
         setIsProcessing(false);
     }
  };

  // Updated Export Handler accepting Custom Title/Description
  const handleExportToClickUp = async (mode: ClickUpExportMode, listId: string, customTitle: string, customDescription: string) => {
    setExportError(null);
    const savedConfig = localStorage.getItem('bugsnap_config');
    if (!savedConfig) {
        setExportError("Please configure ClickUp in Integrations first.");
        return;
    }
    const config: IntegrationConfig = JSON.parse(savedConfig);
    if (!config.clickUpToken) {
        setExportError("Missing ClickUp Token in Integrations.");
        return;
    }

    setIsExporting(true);
    try {
        let taskUrl = "";

        if (mode === 'current') {
            const task = await createClickUpTask({
                listId: listId,
                token: config.clickUpToken,
                title: customTitle || activeSlide.name || 'Bug Report',
                description: customDescription || generateTaskDescription(activeSlide)
            });
            taskUrl = task.url;
            
            const blob = await generateCompositeImage(activeSlide);
            await uploadClickUpAttachment(task.id, config.clickUpToken, blob, 'report.png');
        } 
        else if (mode === 'all_attachments') {
            const masterTask = await createClickUpTask({
                listId: listId,
                token: config.clickUpToken,
                title: customTitle || `Bug Report - ${new Date().toLocaleString()}`,
                description: customDescription || generateMasterDescription(slides)
            });
            taskUrl = masterTask.url;

            for (const slide of slides) {
                const blob = await generateCompositeImage(slide);
                await uploadClickUpAttachment(masterTask.id, config.clickUpToken, blob, `${slide.name}.png`);
            }
        }
        else if (mode === 'all_subtasks') {
            const masterTask = await createClickUpTask({
                listId: listId,
                token: config.clickUpToken,
                title: customTitle || `Bug Report - ${new Date().toLocaleString()}`,
                description: customDescription || generateMasterDescription(slides)
            });
            taskUrl = masterTask.url;

            for (const slide of slides) {
                const subTask = await createClickUpTask({
                    listId: listId,
                    token: config.clickUpToken,
                    title: slide.name || 'Slide Issue',
                    description: generateTaskDescription(slide),
                    parentId: masterTask.id
                });
                
                const blob = await generateCompositeImage(slide);
                await uploadClickUpAttachment(subTask.id, config.clickUpToken, blob, 'report.png');
            }
        }

        setIsClickUpModalOpen(false);
        setCreatedTaskUrl(taskUrl);

    } catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        setExportError(msg);
        if (!msg.includes('corsdemo')) {
            addToast(msg, 'error');
        }
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportToSlack = async (mode: SlackExportMode) => {
    setExportError(null);
    const savedConfig = localStorage.getItem('bugsnap_config');
    if (!savedConfig) {
        setExportError("Please configure Slack in Integrations first.");
        return;
    }
    const config: IntegrationConfig = JSON.parse(savedConfig);
    if (!config.slackToken || !config.slackChannel) {
        setExportError("Missing Slack Bot Token or Channel ID in Integrations.");
        return;
    }

    setIsExporting(true);
    try {
        if (mode === 'current') {
            const blob = await generateCompositeImage(activeSlide);
            await uploadSlackFile(
                config.slackToken,
                config.slackChannel,
                blob,
                'bug_report.png',
                activeSlide.name || 'Bug Report'
            );
            await postSlackMessage(config.slackToken, config.slackChannel, generateSlideMessage(activeSlide));
        }
        else if (mode === 'all_files') {
            for (const slide of slides) {
                const blob = await generateCompositeImage(slide);
                await uploadSlackFile(
                    config.slackToken,
                    config.slackChannel,
                    blob,
                    `${slide.name}.png`,
                    slide.name
                );
            }
            await postSlackMessage(config.slackToken, config.slackChannel, `Uploaded ${slides.length} bug reports.`);
        }
        else if (mode === 'thread') {
            const threadTs = await postSlackMessage(
                config.slackToken,
                config.slackChannel,
                `*Bug Report Session - ${new Date().toLocaleString()}*\nContains ${slides.length} issues.`
            );

            for (const slide of slides) {
                const blob = await generateCompositeImage(slide);
                await uploadSlackFile(
                    config.slackToken,
                    config.slackChannel,
                    blob,
                    `${slide.name}.png`,
                    slide.name,
                    threadTs
                );
            }
        }

        setIsSlackModalOpen(false);
        addToast("Shared to Slack Successfully!", 'success');

    } catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        setExportError(msg);
         if (!msg.includes('corsdemo')) {
            addToast(msg, 'error');
        }
    } finally {
        setIsExporting(false);
    }
  };

  const activeIndex = slides.findIndex(s => s.id === activeSlideId);

  // --- Close Confirmation Dialog ---
  const CloseConfirmation = () => {
      if (!showCloseConfirm) return null;
      return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-[#272727]">
                  <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
                          <AlertTriangle size={24} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Close Session?</h3>
                      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-2">
                          Are you sure you want to leave the editor? Unsaved progress might be lost.
                      </p>
                      <div className="flex gap-3 w-full mt-2">
                          <button 
                              onClick={() => setShowCloseConfirm(false)}
                              className="flex-1 py-2 rounded-lg font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#272727] transition"
                          >
                              Cancel
                          </button>
                          <button 
                              onClick={() => { setShowCloseConfirm(false); onClose(); }}
                              className="flex-1 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 transition"
                          >
                              Close Session
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )
  }

  // --- Success Modal ---
  const SuccessModal = () => {
      if (!createdTaskUrl) return null;
      return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-[#272727] flex flex-col items-center text-center transition-colors">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4 shadow-sm">
                      <Check size={32} strokeWidth={3} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Task Created!</h2>
                  <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6 leading-relaxed">
                      Successfully exported to ClickUp.
                  </p>
                  <a 
                      href={createdTaskUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full py-3 bg-[#7B68EE] hover:bg-[#6c5ce7] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 mb-3 transform active:scale-95"
                      onClick={() => setCreatedTaskUrl(null)}
                  >
                      Open in ClickUp <ExternalLink size={18} />
                  </a>
                  <button 
                      onClick={() => setCreatedTaskUrl(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 text-sm font-medium py-2 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-[#272727] transition"
                  >
                      Close
                  </button>
              </div>
          </div>
      )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0f0f0f] relative transition-colors">
      <CloseConfirmation />
      <SuccessModal />
      
      <IntegrationModal 
        isOpen={!!integrationModalSource}
        source={integrationModalSource}
        onClose={() => setIntegrationModalSource(null)}
        currentConfig={(() => {
            const saved = localStorage.getItem('bugsnap_config');
            return saved ? JSON.parse(saved) : {};
        })()}
        onSave={handleSaveIntegration}
      />

      <ClickUpModal 
        isOpen={isClickUpModalOpen} 
        onClose={() => {
            setIsClickUpModalOpen(false);
            setExportError(null);
        }}
        onExport={handleExportToClickUp}
        loading={isExporting}
        slides={slides}
        activeSlideId={activeSlideId}
        error={exportError}
        onConfigure={() => { setIsClickUpModalOpen(false); setIntegrationModalSource('ClickUp'); }}
      />
      
      <SlackModal 
        isOpen={isSlackModalOpen}
        onClose={() => {
            setIsSlackModalOpen(false);
            setExportError(null);
        }}
        onExport={handleExportToSlack}
        loading={isExporting}
        slides={slides}
        error={exportError}
        onConfigure={() => { setIsSlackModalOpen(false); setIntegrationModalSource('Slack'); }}
      />

      {/* Toolbar */}
      <div className="h-14 border-b border-slate-200 dark:border-[#272727] flex items-center justify-between px-4 bg-white dark:bg-[#0f0f0f] shrink-0 z-20 transition-colors">
        <div className="flex items-center h-full">
           <button 
             onClick={() => setShowCloseConfirm(true)}
             className="mr-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition"
             title="Close Session"
           >
             <X size={20} />
           </button>
           <div className="w-px h-6 bg-slate-200 dark:bg-[#272727] mr-3"></div>

          {/* Shapes */}
          <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-[#272727] h-8">
            <button 
              onClick={() => setSelectedTool(ToolType.SELECT)}
              className={`p-1.5 rounded transition-all ${selectedTool === ToolType.SELECT ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-[#272727]'}`}
              title="Select / Edit"
            >
              <MousePointer2 size={20} />
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-[#272727] mx-1"></div>
            <button 
              onClick={() => setSelectedTool(ToolType.RECTANGLE)}
              className={`p-1.5 rounded transition-all ${selectedTool === ToolType.RECTANGLE ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700 cursor-crosshair' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-[#272727]'}`}
              title="Rectangle"
            >
              <Square size={20} />
            </button>
            <button 
              onClick={() => setSelectedTool(ToolType.CIRCLE)}
              className={`p-1.5 rounded transition-all ${selectedTool === ToolType.CIRCLE ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700 cursor-crosshair' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-[#272727]'}`}
              title="Circle"
            >
              <CircleIcon size={20} />
            </button>
          </div>

          {/* Edit Actions */}
          <div className="flex items-center gap-2 px-4 border-r border-slate-200 dark:border-[#272727] h-8">
            <button onClick={handleUndo} className="text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#272727] p-1.5 rounded" title="Undo (Last Annotation)">
              <Undo2 size={20} />
            </button>
            {selectedAnnotationId && (
                <button 
                onClick={handleDeleteSelected} 
                className="p-1.5 rounded transition-colors text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete Selected Annotation"
                >
                <Trash2 size={20} />
                </button>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-3 px-4 h-8">
            <button onClick={handlePrevSlide} disabled={activeIndex <= 0} className="text-slate-500 dark:text-zinc-400 disabled:text-slate-300 dark:disabled:text-zinc-700 hover:text-slate-800 dark:hover:text-white">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-medium text-slate-600 dark:text-zinc-300 tabular-nums select-none">
              {activeIndex + 1} / {slides.length}
            </span>
            <button onClick={handleNextSlide} disabled={activeIndex >= slides.length - 1} className="text-slate-500 dark:text-zinc-400 disabled:text-slate-300 dark:disabled:text-zinc-700 hover:text-slate-800 dark:hover:text-white">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button 
             onClick={handleGeneratePDF}
             disabled={isProcessing}
             className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#272727] px-3 py-1.5 rounded border border-slate-200 dark:border-[#272727] text-xs font-semibold disabled:opacity-50 transition-colors"
             title="Download as PDF"
           >
             {isProcessing ? <div className="w-3 h-3 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin"/> : <FileText size={14} />}
             PDF
           </button>
           <button 
             onClick={handleCopySlide}
             disabled={isProcessing}
             className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#272727] px-3 py-1.5 rounded border border-slate-200 dark:border-[#272727] text-xs font-semibold disabled:opacity-50 transition-colors"
             title="Copy image to clipboard"
           >
             {isProcessing ? <div className="w-3 h-3 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin"/> : <ClipboardCopy size={14} />}
             Copy Slide
           </button>
           
           <div className="w-px h-5 bg-slate-200 dark:bg-[#272727] mx-1"></div>

           <button 
                onClick={() => setIsClickUpModalOpen(true)}
                className="flex items-center gap-1.5 bg-[#7B68EE] hover:bg-[#6c5ce7] text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm transition-colors ml-auto"
            >
               <Layers size={14} /> Export to ClickUp
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-24 bg-white dark:bg-[#0f0f0f] border-r border-slate-200 dark:border-[#272727] flex flex-col py-4 relative shrink-0 transition-colors">
           <div className="flex-1 overflow-y-auto flex flex-col items-center gap-3 px-1 no-scrollbar">
             {slides.map((s, i) => (
               <div 
                 key={s.id} 
                 onClick={() => onSelectSlide(s.id)}
                 className={`relative group cursor-pointer w-16 h-16 rounded-lg border-2 overflow-hidden transition-all shrink-0 ${s.id === activeSlideId ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-slate-200 dark:border-[#3f3f3f] hover:border-slate-300 dark:hover:border-slate-500'}`}
               >
                 {s.type === 'video' ? (
                   <video src={s.src} className="w-full h-full object-cover pointer-events-none" />
                 ) : (
                   <img src={s.src} alt={`Slide ${i+1}`} className="w-full h-full object-cover pointer-events-none" />
                 )}
                 {s.annotations.length > 0 && (
                   <div className="absolute bottom-0.5 right-0.5 bg-blue-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm">
                     {s.annotations.length}
                   </div>
                 )}
                 <button 
                   onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSlide(s.id);
                   }}
                   className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10"
                   title="Delete Slide"
                 >
                   <Trash2 size={12} />
                 </button>
               </div>
             ))}
             
             {/* Sticky Add Button - Positioned directly next to slides */}
             <div className="sticky bottom-0 w-full flex justify-center pb-2 pt-2 bg-white dark:bg-[#0f0f0f] z-10" ref={addMenuRef}>
                {isAddMenuOpen && (
                   <div className="absolute bottom-full left-1 mb-2 w-44 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-xl border border-slate-200 dark:border-[#272727] p-1 flex flex-col gap-1 z-50 animate-in slide-in-from-bottom-2 overflow-hidden">
                       <button onClick={() => { setIsAddMenuOpen(false); onCaptureScreen(); }} className="flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-[#272727] rounded-lg hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Camera size={16} className="text-blue-500 dark:text-blue-400" /> Capture Screen</button>
                       <button onClick={() => { setIsAddMenuOpen(false); onRecordVideo(); }} className="flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-[#272727] rounded-lg hover:text-purple-600 dark:hover:text-purple-400 transition-colors"><Video size={16} className="text-purple-500 dark:text-purple-400" /> Record Video</button>
                       <button onClick={() => { setIsAddMenuOpen(false); onAddSlide(); }} className="flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-[#272727] rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"><Upload size={16} className="text-emerald-500 dark:text-emerald-400" /> Upload File</button>
                   </div>
                )}
                <button onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} className={`w-14 h-14 border-2 border-dashed rounded-xl flex items-center justify-center transition-all shadow-sm bg-white dark:bg-[#1e1e1e] ${isAddMenuOpen ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-slate-300 dark:border-[#3f3f3f] text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-[#272727]'}`}><Plus size={24} className={isAddMenuOpen ? 'rotate-45 transition-transform' : 'transition-transform'} /></button>
             </div>
           </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-slate-100 dark:bg-[#0f0f0f] overflow-hidden relative flex items-center justify-center transition-colors">
           <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
           <div 
             ref={containerRef}
             className={`relative shadow-2xl bg-black select-none max-w-[95%] max-h-[90%] ${isDrawing || selectedTool !== ToolType.SELECT ? 'cursor-crosshair' : ''}`}
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}
           >
              {activeSlide.type === 'video' ? (
                <video ref={mediaRef as any} src={activeSlide.src} className="max-h-[85vh] block" onTimeUpdate={() => { if (mediaRef.current) setCurrentTime((mediaRef.current as HTMLVideoElement).currentTime); }}/>
              ) : (
                <img ref={mediaRef as any} src={activeSlide.src} alt="Canvas" className="max-h-[85vh] block draggable-none" draggable={false} />
              )}
              {/* Annotations Overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {annotations.map((ann, index) => {
                   if (activeSlide.type === 'video' && ann.timestamp !== undefined && Math.abs(ann.timestamp - currentTime) > 0.5) return null;
                   const isSelected = selectedAnnotationId === ann.id;
                   const minX = Math.min(ann.start.x, ann.end.x);
                   const minY = Math.min(ann.start.y, ann.end.y);
                   const width = Math.abs(ann.end.x - ann.start.x);
                   const height = Math.abs(ann.end.y - ann.start.y);
                   return (
                     <g key={ann.id} className={`pointer-events-auto group ${isSelected && selectedTool === ToolType.SELECT ? 'cursor-move' : 'cursor-pointer'}`} onClick={(e) => { e.stopPropagation(); setSelectedAnnotationId(ann.id); }}>
                       {ann.type === ToolType.RECTANGLE && <rect x={minX} y={minY} width={width} height={height} fill={hexToRgba(ann.color, 0.2)} stroke={isSelected ? "#3b82f6" : ann.color} strokeWidth={3} rx={4} />}
                       {ann.type === ToolType.CIRCLE && <ellipse cx={minX + width / 2} cy={minY + height / 2} rx={width / 2} ry={height / 2} fill={hexToRgba(ann.color, 0.2)} stroke={isSelected ? "#3b82f6" : ann.color} strokeWidth={3} />}
                       {isSelected && (<><rect x={minX-5} y={minY-5} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="2"/><rect x={minX+width-5} y={minY-5} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="2"/><rect x={minX-5} y={minY+height-5} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="2"/><rect x={minX+width-5} y={minY+height-5} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="2"/></>)}
                       <g transform={`translate(${minX}, ${minY})`}><rect x="-12" y="-12" width="24" height="24" rx="6" fill={isSelected ? "#3b82f6" : ann.color} /><text x="0" y="5" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{index + 1}</text></g>
                     </g>
                   );
                })}
                {isDrawing && startPoint && currentPoint && !resizeHandle && !isDraggingShape && (
                   <g>
                      {selectedTool === ToolType.RECTANGLE && <rect x={Math.min(startPoint.x, currentPoint.x)} y={Math.min(startPoint.y, currentPoint.y)} width={Math.abs(currentPoint.x - startPoint.x)} height={Math.abs(currentPoint.y - startPoint.y)} fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4" />}
                      {selectedTool === ToolType.CIRCLE && <ellipse cx={startPoint.x + (currentPoint.x - startPoint.x) / 2} cy={startPoint.y + (currentPoint.y - startPoint.y) / 2} rx={Math.abs((currentPoint.x - startPoint.x) / 2)} ry={Math.abs((currentPoint.y - startPoint.y) / 2)} fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4" />}
                   </g>
                )}
              </svg>
           </div>
           {activeSlide.type === 'video' && (
             <div className="absolute bottom-8 bg-slate-900/80 backdrop-blur text-white p-2 rounded-full flex items-center gap-4 px-6 shadow-xl z-10">
                <button onClick={() => { if (mediaRef.current) { if (isPlaying) (mediaRef.current as HTMLVideoElement).pause(); else (mediaRef.current as HTMLVideoElement).play(); setIsPlaying(!isPlaying); } }}>{isPlaying ? <Pause size={20} /> : <Play size={20} />}</button>
                <span className="font-mono text-sm">{currentTime.toFixed(1)}s</span>
             </div>
           )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-white dark:bg-[#0f0f0f] border-l border-slate-200 dark:border-[#272727] flex flex-col shrink-0 transition-colors">
           <div className="h-12 border-b border-slate-100 dark:border-[#272727] flex items-center justify-between px-4">
             <h3 className="font-bold text-slate-800 dark:text-white text-lg">Comments</h3>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {annotations.length === 0 ? (
                <div className="text-center mt-10 opacity-40 dark:text-zinc-400"><MousePointer2 size={48} className="mx-auto mb-2" /><p className="text-sm">Draw a shape to start annotating</p></div>
              ) : (
                annotations.map((ann, index) => (
                  <div key={ann.id} className={`relative group rounded-xl border p-3 transition-all ${selectedAnnotationId === ann.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm' : 'border-slate-200 dark:border-[#272727] bg-white dark:bg-[#1e1e1e] hover:border-blue-300 dark:hover:border-blue-700'}`} onClick={() => setSelectedAnnotationId(ann.id)}>
                    <div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 text-white rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: ann.color }}>{index + 1}</div><div className="ml-auto flex"><button onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button></div></div>
                    <textarea 
                        ref={el => { commentRefs.current[ann.id] = el; }}
                        className="w-full text-sm bg-transparent border-none resize-y focus:ring-0 p-0 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 min-h-[60px]" 
                        placeholder="Describe the issue..." 
                        rows={3} 
                        value={ann.comment} 
                        onChange={(e) => handleCommentChange(ann.id, e.target.value)} 
                    />
                    {ann.comment.length > 3 && (<div className="mt-2 flex"><button onClick={(e) => { e.stopPropagation(); handleAiRefine(ann.id); }} disabled={aiLoadingId === ann.id} className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-2 py-1 rounded-md transition-colors"><Wand2 size={12} className={aiLoadingId === ann.id ? 'animate-spin' : ''} />{aiLoadingId === ann.id ? 'Refining...' : 'Auto-Fix Grammar'}</button></div>)}
                  </div>
                ))
              )}
           </div>
           <div className="p-4 border-t border-slate-100 dark:border-[#272727]">
              <button onClick={() => { setAnnotations([]); onUpdateSlide({...activeSlide, annotations: []}); }} className="w-full py-3 border border-slate-200 dark:border-[#272727] text-slate-500 dark:text-zinc-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition font-medium">Discard All</button>
           </div>
        </div>
      </div>
    </div>
  );
};
