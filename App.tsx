
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { User, AppView, Slide, IntegrationConfig, IntegrationSource, ReportedIssue } from './types';
import { Editor } from './components/Editor';
import { Dashboard } from './components/Dashboard';
import { IntegrationsHub } from './components/IntegrationsHub';
import { useToast } from './components/ToastProvider';
import { fetchClickUpTasks, getAllClickUpLists } from './services/clickUpService';
import { fetchJiraIssues } from './services/jiraService';
import { postSlackMessage, generateDashboardSummary } from './services/slackService';
import { postTeamsMessage } from './services/teamsService';
import { saveSlidesToDB, loadSlidesFromDB } from './services/storageService';
import { 
  LogOut, 
  Monitor,
  Camera,
  Video,
  Upload,
  LayoutTemplate,
  Zap,
  ExternalLink,
  Aperture,
  X,
  Home,
  PenTool,
  User as UserIcon,
  Moon,
  Sun,
  Plus,
  Trash2
} from 'lucide-react';

// Helper to get Client ID from Env or Fallback
const getClientId = () => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        // @ts-ignore
        return import.meta.env.VITE_GOOGLE_CLIENT_ID;
    }
    return "1070648127842-br5nqmcsqq2ufbd4hpajfu8llu0an9t8.apps.googleusercontent.com";
};

const GOOGLE_CLIENT_ID = getClientId();

// --- Floating Widget Component (Rendered in PIP Window) ---
// Using inline styles to prevent FOUC (Flash of Unstyled Content) in the new window context
const FloatingSnapWidget = ({ onSnap, onStop, slideCount, isSnapping }: { onSnap: () => Promise<boolean>, onStop: () => void, slideCount: number, isSnapping: boolean }) => {
  const [flashing, setFlashing] = useState(false);

  const handleSnap = async () => {
     if (isSnapping) return;
     // Trigger the snap action
     const success = await onSnap();
     
     if (success) {
         setFlashing(true);
         setTimeout(() => setFlashing(false), 500);
     }
  };

  return (
    <div 
      style={{ 
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#18181b', // Immediate dark background (zinc-950)
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: '0 12px',
        boxSizing: 'border-box',
        opacity: isSnapping ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
        {/* Left: Counter Badge */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600',
            minWidth: '48px',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
           <div style={{
               width: '8px',
               height: '8px',
               borderRadius: '50%',
               backgroundColor: flashing ? '#4ade80' : '#3b82f6',
               transition: 'background-color 0.2s'
           }} />
           <span style={{ lineHeight: 1 }}>{slideCount}</span>
        </div>

        {/* Center: Action Button */}
        <button 
             onClick={handleSnap}
             disabled={isSnapping}
             style={{
                 flex: 1,
                 margin: '0 12px',
                 height: '36px',
                 backgroundColor: '#ffffff',
                 color: '#000000',
                 border: 'none',
                 borderRadius: '8px',
                 fontSize: '13px',
                 fontWeight: '800',
                 cursor: 'pointer',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 gap: '8px',
                 opacity: isSnapping ? 0.5 : 1,
                 boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
             }}
        >
             <Camera size={18} color="black" />
             SNAP
        </button>
           
        {/* Right: Close/Stop */}
        <button 
             onClick={onStop}
             style={{
                 background: 'none',
                 border: 'none',
                 color: '#a1a1aa', // zinc-400
                 cursor: 'pointer',
                 padding: '8px',
                 display: 'flex',
                 alignItems: 'center',
                 borderRadius: '50%',
                 transition: 'background 0.2s'
             }}
             onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
             onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.backgroundColor = 'transparent'; }}
             title="End Session"
        >
             <X size={20} />
        </button>
    </div>
  );
};

// --- Modal for Restricted Iframe Environments ---
const RestrictedModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center backdrop-blur-md p-4 animate-in fade-in">
       <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-[#272727] relative">
           <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">
             <X size={20} />
           </button>
           <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-full flex items-center justify-center mb-5 mx-auto">
              <ExternalLink size={28} />
           </div>
           <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">Open in New Tab Required</h2>
           <p className="text-center text-slate-600 dark:text-zinc-400 text-sm mb-6 leading-relaxed">
              For security reasons, browsers block the <strong>Floating Widget</strong> feature inside this preview frame.
              <br/><br/>
              Please use the <strong>"Open in New Tab"</strong> button in your editor's toolbar to launch the app in a standalone tab.
           </p>
           <button onClick={onClose} className="w-full bg-slate-900 dark:bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-700 transition">
              Understood
           </button>
       </div>
    </div>
  )
}

const App: React.FC = () => {
  // 1. Lazy Init User
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('bugsnap_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  // 2. Slides State (Loaded from IndexedDB)
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isSlidesLoaded, setIsSlidesLoaded] = useState(false);

  // 3. Lazy Init Active Slide
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);

  // 4. Lazy Init View
  const [view, setView] = useState<AppView>(() => {
    // Check if user exists in storage (simulating the lazy init result)
    const savedUserStr = localStorage.getItem('bugsnap_user');
    if (savedUserStr) {
       // Default to Dashboard
       return AppView.DASHBOARD;
    }
    return AppView.LOGIN;
  });

  // 5. Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('bugsnap_theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [isRestrictedModalOpen, setIsRestrictedModalOpen] = useState(false);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null); // Capture Stream
  const pipWindowRef = useRef<Window | null>(null); // Floating Window
  const pipRootRef = useRef<ReactDOM.Root | null>(null); // React Root for PIP
  const [isFloatingSnapping, setIsFloatingSnapping] = useState(false);

  // UI State for Menu
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  // --- Theme Effect ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('bugsnap_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('bugsnap_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- Persistence Effect (IndexedDB) ---
  
  // Load on mount
  useEffect(() => {
      const initSlides = async () => {
          try {
              const loadedSlides = await loadSlidesFromDB();
              setSlides(loadedSlides);
              if (loadedSlides.length > 0 && !activeSlideId) {
                  setActiveSlideId(loadedSlides[0].id);
              }
          } catch (e) {
              console.error("Failed to load slides", e);
          } finally {
              setIsSlidesLoaded(true);
          }
      };
      
      initSlides();
  }, []);

  // Save on change
  useEffect(() => {
    if (isSlidesLoaded) {
        saveSlidesToDB(slides);
    }
    
    // Update PIP window if open
    if (pipRootRef.current && pipWindowRef.current) {
        renderPipContent();
    }
  }, [slides, isSlidesLoaded, isFloatingSnapping]); 

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // --- Background Scheduler ---
  useEffect(() => {
    const checkSchedule = async () => {
        try {
            const savedConfig = localStorage.getItem('bugsnap_config');
            if (!savedConfig) return;
            const config: IntegrationConfig = JSON.parse(savedConfig);

            if (!config.scheduleEnabled || !config.scheduleTime || !config.scheduleDays) return;

            const now = new Date();
            const currentDay = now.getDay(); // 0-6
            const [hours, minutes] = config.scheduleTime.split(':').map(Number);
            const scheduledMinutes = hours * 60 + minutes;
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            // Check if today is a scheduled day
            if (!config.scheduleDays.includes(currentDay)) return;

            // Catch-up Logic: 
            // If current time is PAST scheduled time, check if we already ran it today.
            // If not, run it now (Catch-up for missed window when tab was closed).
            if (currentMinutes < scheduledMinutes) return; // Too early

            // Check if already ran today
            if (config.lastScheduleRun) {
                const lastRun = new Date(config.lastScheduleRun);
                if (lastRun.getDate() === now.getDate() && lastRun.getMonth() === now.getMonth() && lastRun.getFullYear() === now.getFullYear()) {
                    return; // Already ran today
                }
            }

            // --- Execute Report ---
            const isLate = (currentMinutes - scheduledMinutes) > 30;
            const msg = isLate ? "Sending missed scheduled report..." : "Generating scheduled report...";
            addToast(msg, 'info');
            
            // 1. Fetch Data
            let issues: ReportedIssue[] = [];
            let sourceAttempted = false;

            if (config.clickUpToken) {
                let targetListId = config.clickUpListId;
                
                // If no List ID is saved, try to find one automatically
                if (!targetListId) {
                    try {
                        const lists = await getAllClickUpLists(config.clickUpToken);
                        if (lists.length > 0) {
                            targetListId = lists[0].id;
                            // Persist this discovered list so we don't have to fetch it every time
                            config.clickUpListId = targetListId;
                            config.clickUpListName = lists[0].name;
                            localStorage.setItem('bugsnap_config', JSON.stringify(config));
                        }
                    } catch(e) {
                        console.error("Auto-discovery of ClickUp list failed during schedule", e);
                    }
                }

                if (targetListId) {
                    sourceAttempted = true;
                    issues = await fetchClickUpTasks(targetListId, config.clickUpToken);
                }
            }
            
            if (!sourceAttempted && config.jiraUrl && config.jiraToken && config.jiraEmail) {
                sourceAttempted = true;
                issues = await fetchJiraIssues({ domain: config.jiraUrl, email: config.jiraEmail, token: config.jiraToken });
            }

            if (!sourceAttempted) {
                // If no source is configured, we can't generate a report.
                console.warn("Scheduled report skipped: No ClickUp or Jira configured.");
                return;
            }

            // Note: If source IS configured but issues.length is 0, we SHOULD proceed.
            // 0 issues is a valid report (e.g. "0 Pending Issues").

            // 2. Calculate Metrics
            const total = issues.length;
            const resolvedStatuses = ['complete', 'closed', 'resolved', 'done', 'completed'];
            const resolvedCount = issues.filter(i => resolvedStatuses.includes(i.status.toLowerCase())).length;
            const openCount = total - resolvedCount;
            const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;
            const priorityDist = { Urgent: 0, High: 0, Normal: 0, Low: 0 };
            issues.forEach(i => { if (priorityDist[i.priority as keyof typeof priorityDist] !== undefined) priorityDist[i.priority as keyof typeof priorityDist]++; });
            const priorityData = Object.keys(priorityDist).map(k => ({ name: k, count: priorityDist[k as keyof typeof priorityDist] }));
            
            const metrics = { total, openCount, resolvedCount, resolutionRate, priorityData };

            // 3. Send Report
            let reportSent = false;
            if (config.schedulePlatform === 'Slack' && config.slackToken && config.slackChannel) {
                const summary = generateDashboardSummary(metrics);
                await postSlackMessage(config.slackToken, config.slackChannel, summary);
                addToast("Scheduled report sent to Slack", 'success');
                reportSent = true;
            } else if (config.schedulePlatform === 'Teams' && config.teamsWebhookUrl) {
                const priorityText = (priorityData || []).map((p: any) => `- **${p.name}**: ${p.count}`).join('\n');
                const summary = `**BugSnap Daily Report**\n\n` +
                       `✅ **Resolved:** ${resolvedCount}\n\n` +
                       `⏳ **Pending:** ${openCount}\n\n` +
                       `**Priority:**\n${priorityText || 'No active issues'}`;
                await postTeamsMessage(config.teamsWebhookUrl, undefined, summary);
                addToast("Scheduled report sent to Teams", 'success');
                reportSent = true;
            }

            // 4. Update Last Run
            if (reportSent) {
                config.lastScheduleRun = new Date().toISOString();
                localStorage.setItem('bugsnap_config', JSON.stringify(config));
            } else {
                console.warn("Schedule triggered but no platform configured or sending failed.");
            }

        } catch (e) {
            console.error("Scheduled report failed", e);
        }
    };

    // Run check every 60 seconds
    const intervalId = setInterval(checkSchedule, 60000);
    // Initial check on mount
    checkSchedule();
    
    return () => clearInterval(intervalId);
  }, [addToast]);

  // Click outside listener for menu
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

  // --- Auth Logic ---

  const handleLoginSuccess = (user: User) => {
    setUser(user);
    setView(AppView.DASHBOARD);
    localStorage.setItem('bugsnap_user', JSON.stringify(user));
    addToast(`Welcome back, ${user.name}!`, 'success');
  };

  const handleLogout = () => {
    setUser(null);
    setView(AppView.LOGIN);
    setSlides([]); // Clear slides from state
    setActiveSlideId(null);
    saveSlidesToDB([]); // Clear DB
    localStorage.removeItem('bugsnap_user');
    addToast('Logged out successfully', 'info');
  };

  const handleGuestLogin = () => {
      const guestUser: User = {
          id: 'guest-' + Date.now(),
          name: 'Guest User',
          email: 'guest@bugsnap.dev',
          isDemo: true
      };
      handleLoginSuccess(guestUser);
  };

  // --- Google Auth --- (Code same as before)
  const decodeJwt = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to decode JWT", e);
        return null;
    }
  };

  const handleGoogleCallback = (response: any) => {
    try {
        const payload = decodeJwt(response.credential);
        if (payload) {
            const googleUser: User = {
                id: payload.sub,
                name: payload.name,
                email: payload.email,
                avatar: payload.picture,
                isDemo: false
            };
            handleLoginSuccess(googleUser);
        }
    } catch (error) {
        addToast("Google Login failed. Please try again.", "error");
    }
  };

  // Robust initialization handling
  useEffect(() => {
    setOrigin(window.location.origin);
    
    if (user) return; // Don't init if already logged in

    // Define the retry logic
    const initGSI = () => {
        if (typeof window === 'undefined') return;
        
        // Check if the script is loaded
        if (!(window as any).google || !(window as any).google.accounts) {
            // Script not ready yet, try again in 500ms
            return false;
        }

        try {
            (window as any).google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCallback
            });
            
            const btnContainer = document.getElementById("googleSignInButton");
            if (btnContainer) {
                // Clear any existing content to avoid duplicates
                btnContainer.innerHTML = '';
                (window as any).google.accounts.id.renderButton(
                    btnContainer,
                    { theme: isDarkMode ? "filled_black" : "outline", size: "large", width: "350", text: "continue_with" } 
                );
                return true; // Success
            }
        } catch (e) {
            console.error("Error initializing Google Sign In", e);
        }
        return false;
    };

    // Attempt to init immediately
    if (!initGSI()) {
        // If failed, poll every 500ms until success or 10 seconds pass
        const intervalId = setInterval(() => {
            if (initGSI()) {
                clearInterval(intervalId);
            }
        }, 500);

        // Clear interval after 10 seconds to stop checking
        const timeoutId = setTimeout(() => clearInterval(intervalId), 10000);

        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };
    }
  }, [user, view, isDarkMode]); // Re-run if user logs out or view changes or theme changes


  const copyOrigin = () => {
      navigator.clipboard.writeText(origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast("URL copied to clipboard", 'info');
  };


  // --- Capture Logic (Updated for Base64 Persistence) ---
  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    let firstNewSlideId: string | null = null;
    let count = 0;
    const fileArray = Array.from(files);

    // Process files sequentially to maintain order and update state correctly
    // We use FileReader to get Base64
    fileArray.forEach((file, index) => {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (isImage || isVideo) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const base64Data = e.target?.result as string;
            
            setSlides(prev => {
                const newSlide: Slide = {
                  id: crypto.randomUUID(),
                  type: isVideo ? 'video' : 'image',
                  src: base64Data, // Persistable Base64
                  name: file.name,
                  annotations: [],
                  createdAt: Date.now() + index
                };
                
                // If it's the first one added in this batch, switch to it
                if (!activeSlideId && prev.length === 0) {
                    setActiveSlideId(newSlide.id);
                    setView(AppView.EDITOR);
                } else if (!firstNewSlideId) {
                    // Just mark it for switching if we want auto-switch logic
                    firstNewSlideId = newSlide.id;
                    // Auto-switch to the *first* new slide if user was on dashboard
                    if (view === AppView.DASHBOARD) {
                        setActiveSlideId(newSlide.id);
                        setView(AppView.EDITOR);
                    }
                }
                
                return [...prev, newSlide];
            });
        };
        
        reader.readAsDataURL(file);
        count++;
      }
    });

    if (count > 0) {
      addToast(`Processing ${count} file${count > 1 ? 's' : ''}...`, 'info');
    }
  };

  // --- Video Recording Logic (Updated for Base64) ---
  const handleVideoRecord = async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { displaySurface: "monitor" }, 
            audio: true 
        });
        
        mediaStreamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            
            // Convert to Base64 for persistence
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64Data = reader.result as string;
                
                const newSlide: Slide = {
                    id: crypto.randomUUID(),
                    type: 'video',
                    src: base64Data,
                    name: `Recording ${new Date().toLocaleTimeString()}`,
                    annotations: [],
                    createdAt: Date.now()
                };
                
                setSlides(prev => [...prev, newSlide]);
                setActiveSlideId(newSlide.id);
                setView(AppView.EDITOR);
                setIsRecording(false);
                setRecordingTime(0);
            };
            
            if (timerRef.current) clearInterval(timerRef.current);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        };

        mediaRecorder.start();
        setIsRecording(true);
        setView(AppView.EDITOR); 

        timerRef.current = window.setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);

        // Handle user stopping via browser UI
        stream.getVideoTracks()[0].onended = () => {
             if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        };

    } catch (err) {
        console.error("Video record failed", err);
        addToast("Recording cancelled.", 'info');
    }
  };

  // --- Floating Capture Logic (Updated for Base64) ---
  const handleSnapFromStream = async (): Promise<boolean> => {
      try {
        setIsFloatingSnapping(true);
        // CRITICAL: Increased delay to 400ms to ensure UI is fully transparent before capture.
        await new Promise(r => setTimeout(r, 400));

        // Use EXISTING stream (Persistent connection)
        let stream = mediaStreamRef.current;
        
        // Safety check: if stream ended, try to restart it? No, that would trigger popup. 
        // Just fail gracefully or check if active.
        if (!stream || !stream.active) {
            // Fallback: If for some reason stream is dead, request again (will show popup)
            // But user asked to "default keep entire screen", which implies persistent stream.
            addToast("Stream inactive. Restarting...", "info");
            stream = await navigator.mediaDevices.getDisplayMedia({
                 video: { displaySurface: "monitor" },
                 audio: false
            });
            mediaStreamRef.current = stream;
        }
        
        // 2. Setup Video to grab frame
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true; 
        video.autoplay = true;
        
        // 3. Wait for video metadata and readiness
        await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => {
                video.play().then(() => resolve()).catch(resolve);
            };
        });

        // 4. Ensure frame is rendered
        let attempts = 0;
        while (video.readyState < 2 && attempts < 20) {
            await new Promise(r => setTimeout(r, 50));
            attempts++;
        }
        
        // Additional buffer for paint
        await new Promise(r => setTimeout(r, 100));
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        let success = false;

        if (ctx && canvas.width > 0 && canvas.height > 0) {
            // Draw current frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert to Base64 String (Data URL) - This is persistent!
            const base64Data = canvas.toDataURL('image/png');
            
            const newSlide: Slide = {
                id: crypto.randomUUID(),
                type: 'image',
                src: base64Data, // Persistable Base64
                name: `Snap ${new Date().toLocaleTimeString()}`,
                annotations: [],
                createdAt: Date.now()
            };
            
            setSlides(prev => [...prev, newSlide]);
            // SWITCH TO EDITOR VIEW IMMEDIATELY
            setActiveSlideId(newSlide.id);
            setView(AppView.EDITOR);
            success = true;
        }
        
        // Cleanup temp video but KEEP STREAM OPEN
        video.srcObject = null;
        video.remove();
        canvas.remove();
        
        setIsFloatingSnapping(false);
        return success;

      } catch (e) {
          console.error("Snap failed", e);
          setIsFloatingSnapping(false);
          return false;
      }
  };

  const renderPipContent = () => {
      if (!pipRootRef.current) return;
      pipRootRef.current.render(
          <FloatingSnapWidget 
              onSnap={handleSnapFromStream}
              onStop={() => {
                  if (pipWindowRef.current) pipWindowRef.current.close();
              }}
              slideCount={slides.length}
              isSnapping={isFloatingSnapping}
          />
      );
  };

  const handleFloatingCaptureSession = async () => {
      if (pipWindowRef.current) {
          // Focus the existing window instead of showing an error
          pipWindowRef.current.focus();
          return;
      }

      if (!("documentPictureInPicture" in window)) {
          addToast("Picture-in-Picture API not supported", "error");
          return;
      }

      try {
          // Check if we are inside an iframe (stackblitz/codesandbox preview)
          if (window.self !== window.top) {
              setIsRestrictedModalOpen(true);
              return;
          }

          const pipWindow = await window.documentPictureInPicture.requestWindow({
              width: 260, // Optimized width
              height: 60, // Fixed height
          });
          
          pipWindowRef.current = pipWindow;

          // Copy styles
          [...document.styleSheets].forEach((styleSheet) => {
              try {
                  const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
                  const style = document.createElement('style');
                  style.textContent = cssRules;
                  pipWindow.document.head.appendChild(style);
              } catch (e) {
                  const link = document.createElement('link');
                  link.rel = 'stylesheet';
                  link.type = styleSheet.type;
                  link.media = styleSheet.media.mediaText;
                  link.href = styleSheet.href || '';
                  pipWindow.document.head.appendChild(link);
              }
          });

          // Critical: Set background immediately to prevent white flash
          pipWindow.document.body.style.backgroundColor = '#18181b';
          pipWindow.document.body.style.margin = '0';
          pipWindow.document.body.style.overflow = 'hidden';

          // Create root
          const container = pipWindow.document.createElement('div');
          container.style.height = '100%';
          pipWindow.document.body.appendChild(container);
          
          pipRootRef.current = ReactDOM.createRoot(container);
          renderPipContent();

           // Handle close
           pipWindow.addEventListener('pagehide', () => {
            pipWindowRef.current = null;
            pipRootRef.current = null;
            // cleanup if needed
          });

      } catch (err) {
          console.error("PIP failed", err);
          setIsRestrictedModalOpen(true); // Fallback for error (likely restriction)
      }
  };

  // Wrapper to handle Capture Click - Decides between Floating or Standard Capture
  const handleCaptureClick = async () => {
    // If in Picture-in-Picture supported browser and NOT in iframe (handled inside function), try PIP
    if ("documentPictureInPicture" in window) {
      await handleFloatingCaptureSession();
    } else {
      // Fallback for browsers like Firefox or if user prefers standard
      await handleSnapFromStream();
    }
  };

  const handleCloseSession = () => {
      setSlides([]);
      saveSlidesToDB([]); // Clear DB on session close
      setActiveSlideId(null);
      setView(AppView.DASHBOARD);
  };

  const NavButton = ({ active, onClick, icon: Icon, children }: any) => (
    <button
      onClick={onClick}
      className={`
        relative px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2
        ${active 
          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
          : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-[#272727] hover:text-slate-900 dark:hover:text-white'
        }
      `}
    >
      <Icon size={16} />
      {children}
      {active && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full" />}
    </button>
  );

  return (
    <div className={`h-screen w-screen flex flex-col bg-slate-50 dark:bg-[#0f0f0f] text-slate-900 dark:text-zinc-100 font-sans transition-colors duration-200 ${isDarkMode ? 'dark' : ''}`}>
      {/* Restricted Modal */}
      <RestrictedModal isOpen={isRestrictedModalOpen} onClose={() => setIsRestrictedModalOpen(false)} />
      
      {view === AppView.LOGIN ? (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#0f0f0f] relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[100px]" />

            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-[#272727] m-4 relative z-10">
                {/* Left Panel: Branding */}
                <div className="p-12 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex flex-col justify-between relative overflow-hidden">
                     <div className="relative z-10">
                         <div className="flex items-center gap-3 mb-8">
                             <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                                 <Aperture size={28} className="text-white" />
                             </div>
                             <span className="text-2xl font-bold tracking-tight">BugSnap</span>
                         </div>
                         <h1 className="text-4xl font-extrabold mb-4 leading-tight">Visual Bug Reporting,<br/>Reimagined with AI.</h1>
                         <p className="text-blue-100 text-lg leading-relaxed max-w-md">Capture screenshots, annotate with ease, and let AI generate your bug reports. Sync instantly with ClickUp, Jira, and Slack.</p>
                     </div>
                     
                     <div className="relative z-10 mt-12 grid grid-cols-2 gap-4">
                         <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                             <Monitor className="mb-2 text-blue-200" size={24}/>
                             <div className="font-bold text-lg">Smart Capture</div>
                             <div className="text-sm text-blue-200">Screenshots & Video</div>
                         </div>
                         <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                             <Zap className="mb-2 text-amber-300" size={24}/>
                             <div className="font-bold text-lg">AI Powered</div>
                             <div className="text-sm text-blue-200">Auto-descriptions</div>
                         </div>
                     </div>

                     {/* Abstract Shapes */}
                     <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
                     <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
                </div>

                {/* Right Panel: Login */}
                <div className="p-12 flex flex-col justify-center items-center bg-white dark:bg-[#1e1e1e]">
                     <div className="w-full max-w-sm">
                         <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">Get Started</h2>
                         <p className="text-slate-500 dark:text-zinc-400 text-center mb-8">Sign in to access your dashboard</p>

                         <div className="space-y-4">
                             {/* Google Sign In Wrapper */}
                             <div className="flex justify-center h-[50px] relative overflow-hidden rounded-lg">
                                 <div id="googleSignInButton" className="w-full"></div>
                             </div>

                             <div className="relative flex items-center py-2">
                                 <div className="grow border-t border-slate-200 dark:border-[#3f3f3f]"></div>
                                 <span className="shrink-0 px-4 text-xs text-slate-400 uppercase font-semibold">Or continue as guest</span>
                                 <div className="grow border-t border-slate-200 dark:border-[#3f3f3f]"></div>
                             </div>

                             <button 
                                 onClick={handleGuestLogin}
                                 className="w-full py-3 bg-slate-50 dark:bg-[#272727] hover:bg-slate-100 dark:hover:bg-[#333] text-slate-700 dark:text-zinc-300 font-bold rounded-lg border border-slate-200 dark:border-[#3f3f3f] transition-all flex items-center justify-center gap-2 group"
                             >
                                 <UserIcon size={18} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-zinc-200" />
                                 Continue as Guest
                             </button>
                         </div>
                         
                         <p className="mt-8 text-xs text-center text-slate-400">
                             By continuing, you agree to BugSnap's Terms of Service and Privacy Policy.
                         </p>
                     </div>
                </div>
            </div>
            
            {/* Dark Mode Toggle for Login */}
            <button 
                onClick={toggleTheme}
                className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-[#1e1e1e] shadow-md border border-slate-200 dark:border-[#272727] text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition"
            >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Top Navigation Bar */}
            <div className="h-16 bg-white dark:bg-[#1e1e1e] border-b border-slate-200 dark:border-[#272727] flex items-center justify-between px-6 shrink-0 z-30 transition-colors shadow-sm">
                <div className="flex items-center gap-8">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Aperture size={20} className="text-white" />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">BugSnap</span>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex items-center gap-2">
                        <NavButton active={view === AppView.DASHBOARD} onClick={() => setView(AppView.DASHBOARD)} icon={Home}>Dashboard</NavButton>
                        <NavButton active={view === AppView.EDITOR} onClick={() => setView(AppView.EDITOR)} icon={PenTool}>
                            Editor
                            {slides.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">{slides.length}</span>}
                        </NavButton>
                        <NavButton active={view === AppView.INTEGRATIONS} onClick={() => setView(AppView.INTEGRATIONS)} icon={Zap}>Integrations</NavButton>
                    </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-4">
                    <button onClick={toggleTheme} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition">
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    <div className="flex items-center gap-3 pl-2">
                         {user?.avatar ? (
                             <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-slate-200 dark:border-[#3f3f3f]" />
                         ) : (
                             <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                 {user?.name.charAt(0).toUpperCase()}
                             </div>
                         )}
                         <div className="hidden md:block text-sm">
                             <div className="font-bold text-slate-800 dark:text-white leading-none">{user?.name}</div>
                             <div className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Free Plan</div>
                         </div>
                         <button onClick={handleLogout} className="ml-2 text-slate-400 hover:text-red-500 transition" title="Logout">
                             <LogOut size={18} />
                         </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area - Enforce Scroll */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
               {isRecording && (
                 <div className="bg-red-500 text-white text-xs font-bold px-4 py-1 text-center animate-pulse flex items-center justify-center gap-2 shadow-md z-40">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    Recording Screen... {new Date(recordingTime * 1000).toISOString().substr(14, 5)}
                    <button onClick={() => { 
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                            mediaRecorderRef.current.stop();
                        }
                    }} className="ml-4 bg-white text-red-600 px-2 py-0.5 rounded text-[10px] hover:bg-red-50 uppercase tracking-wide">Stop</button>
                 </div>
               )}

               {view === AppView.DASHBOARD && (
                  <Dashboard 
                    onCapture={handleCaptureClick} 
                    onRecord={handleVideoRecord} 
                    onUpload={() => fileInputRef.current?.click()}
                  />
               )}
               {view === AppView.EDITOR && (
                 <Editor 
                   slides={slides}
                   activeSlideId={activeSlideId!}
                   onSelectSlide={setActiveSlideId}
                   onUpdateSlide={(updated) => setSlides(prev => prev.map(s => s.id === updated.id ? updated : s))}
                   onDeleteSlide={(id) => {
                       const newSlides = slides.filter(s => s.id !== id);
                       setSlides(newSlides);
                       if (newSlides.length === 0) {
                           setActiveSlideId(null); 
                       } else if (activeSlideId === id) {
                           setActiveSlideId(newSlides[0].id);
                       }
                   }}
                   onAddSlide={() => fileInputRef.current?.click()}
                   onCaptureScreen={handleCaptureClick}
                   onRecordVideo={handleVideoRecord}
                   onClose={handleCloseSession}
                 />
               )}
               {view === AppView.INTEGRATIONS && <IntegrationsHub />}
            </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input 
        type="file" 
        multiple 
        accept="image/*,video/*" 
        className="hidden" 
        ref={fileInputRef}
        onChange={(e) => handleFileUpload(e.target.files)}
      />
    </div>
  );
};

export default App;
