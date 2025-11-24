
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { User, AppView, Slide } from './types';
import { Editor } from './components/Editor';
import { Dashboard } from './components/Dashboard';
import { IntegrationsHub } from './components/IntegrationsHub';
import { useToast } from './components/ToastProvider';
import { 
  LogOut, 
  Bug,
  Monitor,
  AlertTriangle,
  Copy,
  Check,
  Camera,
  Video,
  Upload,
  StopCircle,
  LayoutTemplate,
  Zap,
  ExternalLink,
  Aperture,
  X,
  Home,
  PenTool,
  User as UserIcon,
  Moon,
  Sun
} from 'lucide-react';

// REPLACE WITH YOUR ACTUAL GOOGLE CLIENT ID FROM GOOGLE CLOUD CONSOLE
const GOOGLE_CLIENT_ID: string = "1070648127842-br5nqmcsqq2ufbd4hpajfu8llu0an9t8.apps.googleusercontent.com";

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

  // 2. Lazy Init Slides (Persistence Layer)
  const [slides, setSlides] = useState<Slide[]>(() => {
    try {
      const saved = localStorage.getItem('bugsnap_slides');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // 3. Lazy Init Active Slide
  const [activeSlideId, setActiveSlideId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('bugsnap_slides');
      if (saved) {
        const parsed: Slide[] = JSON.parse(saved);
        return parsed.length > 0 ? parsed[0].id : null;
      }
    } catch (e) { return null; }
    return null;
  });

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

  const [isDragging, setIsDragging] = useState(false);
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

  // Area Capture (Crop)
  const [isCropping, setIsCropping] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

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

  // --- Persistence Effect ---
  useEffect(() => {
    localStorage.setItem('bugsnap_slides', JSON.stringify(slides));
    // Update PIP window if open
    if (pipRootRef.current && pipWindowRef.current) {
        renderPipContent();
    }
  }, [slides, isFloatingSnapping]); // Re-render PIP when snapping state changes

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

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
    localStorage.removeItem('bugsnap_user');
    localStorage.removeItem('bugsnap_slides'); // Clear slides from storage on logout
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

  // --- Google Auth Implementation ---

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


  // --- Capture Logic ---
  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    let firstNewSlideId: string | null = null;
    let count = 0;

    Array.from(files).forEach((file, index) => {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (isImage || isVideo) {
        const url = URL.createObjectURL(file);
        const newSlide: Slide = {
          id: crypto.randomUUID(),
          type: isVideo ? 'video' : 'image',
          src: url,
          name: file.name,
          annotations: [],
          createdAt: Date.now() + index
        };
        setSlides(prev => {
            const updated = [...prev, newSlide];
            return updated;
        });
        if (!firstNewSlideId) firstNewSlideId = newSlide.id;
        count++;
      }
    });

    if (count > 0) {
      addToast(`Added ${count} file${count > 1 ? 's' : ''}`, 'success');
    }

    if (firstNewSlideId) {
      setActiveSlideId(firstNewSlideId);
      setView(AppView.EDITOR);
    }
  };

  // --- Video Recording Logic ---
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
            const url = URL.createObjectURL(blob);
            const newSlide: Slide = {
                id: crypto.randomUUID(),
                type: 'video',
                src: url,
                name: `Recording ${new Date().toLocaleTimeString()}`,
                annotations: [],
                createdAt: Date.now()
            };
            setSlides(prev => [...prev, newSlide]);
            setActiveSlideId(newSlide.id);
            setView(AppView.EDITOR);
            setIsRecording(false);
            setRecordingTime(0);
            
            if (timerRef.current) clearInterval(timerRef.current);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        };

        mediaRecorder.start();
        setIsRecording(true);
        setView(AppView.EDITOR); // Go to editor to show overlay

        // Timer
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

  // --- Floating Capture Logic (PIP) ---

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
            
            // Create blob async
            await new Promise<void>((resolve) => {
                canvas.toBlob(blob => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const newSlide: Slide = {
                            id: crypto.randomUUID(),
                            type: 'image',
                            src: url,
                            name: `Snap ${new Date().toLocaleTimeString()}`,
                            annotations: [],
                            createdAt: Date.now()
                        };
                        setSlides(prev => [...prev, newSlide]);
                        success = true;
                    }
                    resolve();
                }, 'image/png');
            });
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
          addToast("Floating widget is already active", "info");
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

          pipWindow.addEventListener('pagehide', () => {
              pipWindowRef.current = null;
              pipRootRef.current = null;
              setIsFloatingSnapping(false);
          });

      } catch (err) {
          console.error("PIP failed", err);
          addToast("Failed to open Floating Widget", "error");
      }
  };

  if (view === AppView.LOGIN) {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-slate-50 dark:bg-[#0f0f0f] p-4 text-center transition-colors">
              <div className="mb-8 relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  <div className="relative w-24 h-24 bg-white dark:bg-[#1e1e1e] rounded-xl flex items-center justify-center shadow-xl">
                      <Bug size={48} className="text-blue-600 dark:text-blue-500" />
                  </div>
              </div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">BugSnap</h1>
              <p className="text-lg text-slate-600 dark:text-zinc-400 mb-8 max-w-md leading-relaxed">
                  The AI-powered visual bug reporting tool for modern engineering teams.
              </p>

              <div className="bg-white dark:bg-[#1e1e1e] p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-[#272727] transition-colors">
                 <div id="googleSignInButton" className="flex justify-center min-h-[44px] mb-4"></div>
                 
                 <div className="relative flex py-4 items-center">
                    <div className="flex-grow border-t border-slate-200 dark:border-[#3f3f3f]"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase">Or continue as</span>
                    <div className="flex-grow border-t border-slate-200 dark:border-[#3f3f3f]"></div>
                 </div>

                 <button 
                   onClick={handleGuestLogin}
                   className="w-full py-3 bg-slate-100 dark:bg-[#272727] hover:bg-slate-200 dark:hover:bg-[#3f3f3f] text-slate-700 dark:text-zinc-300 font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                 >
                   <UserIcon size={18} /> Guest User
                 </button>
              </div>
          </div>
      );
  }

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'dark' : ''}`}>
       <RestrictedModal isOpen={isRestrictedModalOpen} onClose={() => setIsRestrictedModalOpen(false)} />

       {view !== AppView.LOGIN && (
           <div className="flex h-full overflow-hidden">
               {/* Sidebar */}
               <div className="w-16 bg-slate-900 dark:bg-[#050505] flex flex-col items-center py-6 shrink-0 z-50">
                   <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-8 shadow-lg shadow-blue-900/50">
                       <Bug size={24} />
                   </div>
                   
                   <nav className="flex flex-col gap-4 w-full px-2">
                       <NavButton 
                           active={view === AppView.DASHBOARD} 
                           onClick={() => setView(AppView.DASHBOARD)} 
                           icon={<LayoutTemplate size={20} />} 
                           label="Dashboard" 
                       />
                       <NavButton 
                           active={view === AppView.EDITOR} 
                           onClick={() => setView(AppView.EDITOR)} 
                           icon={<PenTool size={20} />} 
                           label="Editor" 
                           badge={slides.length}
                       />
                       <NavButton 
                           active={view === AppView.INTEGRATIONS} 
                           onClick={() => setView(AppView.INTEGRATIONS)} 
                           icon={<Zap size={20} />} 
                           label="Integrations" 
                       />
                   </nav>

                   <div className="mt-auto flex flex-col gap-4 w-full px-2">
                       <button 
                           onClick={toggleTheme}
                           className="w-full aspect-square flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                           title={isDarkMode ? "Light Mode" : "Dark Mode"}
                       >
                           {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                       </button>
                       <div className="w-full h-px bg-white/10"></div>
                       <button 
                           onClick={handleLogout}
                           className="w-full aspect-square flex items-center justify-center rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                           title="Logout"
                       >
                           <LogOut size={20} />
                       </button>
                   </div>
               </div>

               {/* Main Content Area */}
               <div className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-[#0f0f0f]">
                   {view === AppView.DASHBOARD && (
                       <Dashboard 
                           onCapture={() => handleFloatingCaptureSession()} 
                           onRecord={handleVideoRecord} 
                           onUpload={() => fileInputRef.current?.click()} 
                       />
                   )}
                   
                   {view === AppView.EDITOR && (
                       <Editor 
                           slides={slides}
                           activeSlideId={activeSlideId || ''}
                           onSelectSlide={setActiveSlideId}
                           onUpdateSlide={(updated) => setSlides(prev => prev.map(s => s.id === updated.id ? updated : s))}
                           onDeleteSlide={(id) => {
                               const newSlides = slides.filter(s => s.id !== id);
                               setSlides(newSlides);
                               if (newSlides.length === 0) setView(AppView.DASHBOARD);
                               else if (activeSlideId === id) setActiveSlideId(newSlides[0].id);
                           }}
                           onAddSlide={() => fileInputRef.current?.click()}
                           onCaptureScreen={() => handleFloatingCaptureSession()}
                           onRecordVideo={handleVideoRecord}
                           onClose={() => setView(AppView.DASHBOARD)}
                       />
                   )}

                   {view === AppView.INTEGRATIONS && (
                       <IntegrationsHub />
                   )}
               </div>
           </div>
       )}

       {/* Hidden File Input */}
       <input 
           type="file" 
           ref={fileInputRef} 
           className="hidden" 
           accept="image/*,video/*" 
           multiple 
           onChange={(e) => { handleFileUpload(e.target.files); e.target.value = ''; }} 
       />
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label, badge }: any) => (
    <button 
        onClick={onClick}
        className={`w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative group ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        title={label}
    >
        {icon}
        {badge !== undefined && badge > 0 && (
            <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900"></div>
        )}
    </button>
);

export default App;
