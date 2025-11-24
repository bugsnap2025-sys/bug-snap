
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
const FloatingSnapWidget = ({ onSnap, onStop, slideCount, isSnapping }: { onSnap: () => Promise<boolean>, onStop: () => void, slideCount: number, isSnapping: boolean }) => {
  const [flashing, setFlashing] = useState(false);

  const handleSnap = async () => {
     // Trigger the snap action
     const success = await onSnap();
     
     if (success) {
         setFlashing(true);
         setTimeout(() => setFlashing(false), 500);
     }
  };

  return (
    <div 
      className={`h-screen w-screen flex items-center justify-between bg-[#18181b] text-white overflow-hidden transition-opacity duration-150 px-4 select-none ${isSnapping ? 'opacity-0' : 'opacity-100'}`}
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
        {/* Left: Counter Badge */}
        <div 
            className="flex items-center gap-2 bg-zinc-800/80 px-3 py-1.5 rounded-full border border-zinc-700"
            title={`${slideCount} screenshots captured`}
        >
           <div className={`w-2 h-2 rounded-full ${flashing ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
           <span className="font-mono font-bold text-sm tracking-tight leading-none">{slideCount}</span>
        </div>

        {/* Center: Action Button */}
        <button 
             onClick={handleSnap}
             disabled={isSnapping}
             className="flex-1 mx-3 bg-white hover:bg-zinc-200 text-black active:scale-95 transition-all h-10 rounded-lg font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
             aria-label="Capture Screenshot"
        >
             <Camera size={18} className="fill-current" />
             <span>SNAP</span>
        </button>
           
        {/* Right: Close/Stop */}
        <button 
             onClick={onStop}
             className="text-zinc-400 hover:text-red-400 hover:bg-red-900/30 p-2 rounded-lg transition-colors"
             title="End Session"
             aria-label="End Session"
        >
             <StopCircle size={22} />
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

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
  };

  // --- Floating Capture Logic (PIP) ---

  const handleSnapFromStream = async (): Promise<boolean> => {
      try {
        setIsFloatingSnapping(true);
        // CRITICAL: Delay to allow UI to fade out completely. 
        // 150ms is safe for the opacity transition to finish.
        await new Promise(r => setTimeout(r, 150));

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
          addToast("Floating widget is already active.", "info");
          return;
      }

      if (!window.documentPictureInPicture) {
          addToast("Your browser does not support Floating Widgets (PIP). Try Chrome/Edge.", 'error');
          // Fallback to simple screen capture if PIP is not available
          handleScreenSnapshot('full');
          return;
      }

      try {
          // 1. Request Stream FIRST (Persistent) to avoid repetitive popups
          // We ask user to select "Entire Screen" once here.
          addToast("Please select 'Entire Screen' to enable seamless snapping.", "info");
          
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "monitor" },
            audio: false
          });
          mediaStreamRef.current = stream;

          // Handle user stopping stream via browser UI
          stream.getVideoTracks()[0].onended = () => {
             if (pipWindowRef.current) pipWindowRef.current.close();
             mediaStreamRef.current = null;
          };

          // 2. Open PIP Window
          // RESIZED: Smaller window for cleaner UI
          const pipWindow = await window.documentPictureInPicture.requestWindow({
              width: 300,
              height: 60,
          });
          pipWindowRef.current = pipWindow;

          // 3. Copy Styles (Tailwind)
          Array.from(document.styleSheets).forEach((styleSheet) => {
            try {
              if (styleSheet.href) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = styleSheet.type;
                link.media = typeof styleSheet.media === 'string' ? styleSheet.media : styleSheet.media.mediaText;
                link.href = styleSheet.href;
                pipWindow.document.head.appendChild(link);
              } else if (styleSheet.cssRules) {
                const style = document.createElement('style');
                Array.from(styleSheet.cssRules).forEach((rule) => {
                  style.appendChild(document.createTextNode(rule.cssText));
                });
                pipWindow.document.head.appendChild(style);
              }
            } catch (e) {
               const link = document.createElement('link');
               link.rel = 'stylesheet';
               link.href = "https://cdn.tailwindcss.com"; 
               pipWindow.document.head.appendChild(link);
            }
          });
          
          const twScript = document.createElement('script');
          twScript.src = "https://cdn.tailwindcss.com";
          pipWindow.document.head.appendChild(twScript);

          // 4. Mount React Component
          const root = ReactDOM.createRoot(pipWindow.document.body);
          pipRootRef.current = root;
          renderPipContent();

          // 5. Cleanup on close
          pipWindow.addEventListener('pagehide', () => {
               pipRootRef.current?.unmount();
               pipRootRef.current = null;
               pipWindowRef.current = null;
               
               // Stop stream when PIP closes
               if (mediaStreamRef.current) {
                   mediaStreamRef.current.getTracks().forEach(t => t.stop());
                   mediaStreamRef.current = null;
               }
               
               setView(AppView.EDITOR);
               addToast("Capture session ended. Review your slides.", 'info');
          });

          // Stay on Dashboard/Editor view
          setView(AppView.EDITOR);

      } catch (err) {
          console.error("Floating capture session failed", err);
          
          // Improved Error Handling
          if (err instanceof Error) {
              if (err.name === 'NotAllowedError') {
                  // User denied permission or browser blocked it
                  if (window.self !== window.top) {
                      // If in iframe, it might be the PiP restriction
                      setIsRestrictedModalOpen(true);
                  } else {
                      addToast("Screen capture permission denied.", 'error');
                  }
              } else {
                  addToast(`Failed to start session: ${err.message}`, 'error');
              }
          } else {
              addToast("Failed to start capture session.", 'error');
          }
      }
  };

  // Mode = 'full' or 'area'
  const handleScreenSnapshot = async (mode: 'full' | 'area' = 'full') => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { displaySurface: "monitor" },
        audio: false
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      await new Promise(r => setTimeout(r, 500));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(blob => {
          if (blob) {
              const url = URL.createObjectURL(blob);
              
              if (mode === 'area') {
                  setCropImageSrc(url);
                  setIsCropping(true);
                  // Note: We stop the stream later after cropping? 
                  // No, we can stop stream now because we have the image in blob
              } else {
                  const newSlide: Slide = {
                      id: crypto.randomUUID(),
                      type: 'image',
                      src: url,
                      name: `Screenshot ${new Date().toLocaleTimeString()}`,
                      annotations: [],
                      createdAt: Date.now()
                  };
                  setSlides(prev => [...prev, newSlide]);
                  setActiveSlideId(newSlide.id);
                  setView(AppView.EDITOR);
                  addToast('Screen captured successfully', 'success');
              }
          }
        }, 'image/png');
      }
      
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;

    } catch (err) {
      console.error("Screen capture cancelled or failed", err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        addToast("Screen capture permission denied.", 'error');
      } else {
        addToast("Failed to capture screen.", 'error');
      }
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
     const url = URL.createObjectURL(croppedBlob);
     const newSlide: Slide = {
        id: crypto.randomUUID(),
        type: 'image',
        src: url,
        name: `Area Snap ${new Date().toLocaleTimeString()}`,
        annotations: [],
        createdAt: Date.now()
     };
     setSlides(prev => [...prev, newSlide]);
     setActiveSlideId(newSlide.id);
     setView(AppView.EDITOR);
     setIsCropping(false);
     setCropImageSrc(null);
     addToast('Area captured successfully', 'success');
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (e.clipboardData && e.clipboardData.files.length > 0) {
      handleFileUpload(e.clipboardData.files);
    } else if (e.clipboardData) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    handleFileUpload(createFileList([blob]));
                }
            }
        }
    }
  }, []);
  
  const createFileList = (files: File[]) => {
      const dt = new DataTransfer();
      files.forEach(file => dt.items.add(file));
      return dt.files;
  };

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleTriggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteSlide = (id: string) => {
    setSlides(prevSlides => {
        const newSlides = prevSlides.filter(s => s.id !== id);
        if (activeSlideId === id) {
          setActiveSlideId(newSlides.length > 0 ? newSlides[0].id : null);
        }
        return newSlides;
    });
    addToast('Slide deleted', 'info');
  };

  // -- Crop Overlay Component (Internal) --
  const CropOverlay = () => {
      if (!isCropping || !cropImageSrc) return null;
      
      const [start, setStart] = useState<{x: number, y: number} | null>(null);
      const [current, setCurrent] = useState<{x: number, y: number} | null>(null);
      const imgRef = useRef<HTMLImageElement>(null);
      const containerRef = useRef<HTMLDivElement>(null);

      const onMouseDown = (e: React.MouseEvent) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          setStart({x, y});
          setCurrent({x, y});
      };

      const onMouseMove = (e: React.MouseEvent) => {
          if (!start) return;
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          setCurrent({x, y});
      };

      const onMouseUp = () => {
          // We wait for user to click "Done"
      };

      const handleDone = () => {
          if (!start || !current || !imgRef.current) {
               setIsCropping(false);
               return;
          }
          
          // Calculate crop coords relative to actual image size vs displayed size
          const displayedW = imgRef.current.width;
          const displayedH = imgRef.current.height;
          const naturalW = imgRef.current.naturalWidth;
          const naturalH = imgRef.current.naturalHeight;
          
          const scaleX = naturalW / displayedW;
          const scaleY = naturalH / displayedH;

          const x = Math.min(start.x, current.x) * scaleX;
          const y = Math.min(start.y, current.y) * scaleY;
          const w = Math.abs(current.x - start.x) * scaleX;
          const h = Math.abs(current.y - start.y) * scaleY;

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
              ctx.drawImage(imgRef.current, x, y, w, h, 0, 0, w, h);
              canvas.toBlob(blob => {
                  if (blob) handleCropComplete(blob);
              }, 'image/png');
          }
      };

      return (
          <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center p-8">
               <h2 className="text-white text-xl font-bold mb-4">Select Area to Crop</h2>
               <div 
                  ref={containerRef}
                  className="relative border-2 border-white shadow-2xl cursor-crosshair overflow-hidden max-h-[80vh]"
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
               >
                  <img ref={imgRef} src={cropImageSrc} className="max-h-[80vh] block select-none pointer-events-none" />
                  {start && current && (
                      <div 
                         className="absolute border-2 border-blue-500 bg-blue-500/20"
                         style={{
                             left: Math.min(start.x, current.x),
                             top: Math.min(start.y, current.y),
                             width: Math.abs(current.x - start.x),
                             height: Math.abs(current.y - start.y)
                         }}
                      />
                  )}
               </div>
               <div className="mt-6 flex gap-4">
                   <button onClick={() => setIsCropping(false)} className="bg-white text-slate-900 px-6 py-2 rounded font-bold hover:bg-slate-200">Cancel</button>
                   <button onClick={handleDone} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">Done</button>
               </div>
          </div>
      )
  }

  // Detect Preview Environment
  const isPreviewEnv = typeof window !== 'undefined' && (
    window.location.hostname.includes('webcontainer') || 
    window.location.hostname.includes('bolt') || 
    window.location.hostname.includes('stackblitz') ||
    window.location.hostname.includes('preview')
  );

  if (!user || view === AppView.LOGIN) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f0f0f] flex flex-col items-center justify-center p-4 transition-colors">
        <button 
            onClick={toggleTheme}
            className="absolute top-6 right-6 p-2 rounded-full bg-white dark:bg-[#1e1e1e] shadow-sm border border-slate-200 dark:border-[#272727] text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#272727] transition"
        >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="bg-white dark:bg-[#1e1e1e] p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100 dark:border-[#272727]">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
            <Bug size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">BugSnap</h1>
          <p className="text-slate-500 dark:text-zinc-400 mb-8">AI-powered visual bug reporting. Capture, annotate, and push to Jira/ClickUp in seconds.</p>
          
          {/* Google Sign In Container */}
            <div className="min-h-[44px] w-full flex justify-center relative flex-col gap-4">
                 <div id="googleSignInButton" className="w-full flex justify-center">
                    {/* Placeholder to prevent layout shift while script loads */}
                    <div className="w-[350px] h-[44px] bg-slate-100 dark:bg-[#272727] rounded animate-pulse"></div>
                 </div>
                 
                 <div className="flex items-center gap-3 w-full max-w-[350px] mx-auto">
                    <div className="h-px bg-slate-200 dark:bg-[#272727] flex-1"></div>
                    <span className="text-xs text-slate-400 font-medium">OR</span>
                    <div className="h-px bg-slate-200 dark:bg-[#272727] flex-1"></div>
                 </div>
                 
                 <button 
                    onClick={handleGuestLogin}
                    className="flex items-center justify-center gap-2 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors py-2 group"
                 >
                    <UserIcon size={16} className="group-hover:text-blue-600 transition-colors" />
                    Continue as Guest (No Login)
                 </button>
            </div>

          <p className="mt-8 text-xs text-slate-400">v1.0.0 • No credit card required</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-screen flex flex-col bg-slate-50 dark:bg-[#0f0f0f] relative overflow-hidden transition-colors"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input 
        type="file" 
        multiple 
        className="hidden" 
        ref={fileInputRef} 
        onChange={(e) => handleFileUpload(e.target.files)} 
        accept="image/*,video/*"
      />
      
      <RestrictedModal isOpen={isRestrictedModalOpen} onClose={() => setIsRestrictedModalOpen(false)} />
      <CropOverlay />

      {/* Top Navigation Bar */}
      <nav className="bg-white dark:bg-[#0f0f0f] border-b border-slate-200 dark:border-[#272727] h-14 flex items-center justify-between px-4 shrink-0 z-30 transition-colors">
        <div className="flex items-center gap-6">
           {/* Logo */}
           <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-lg cursor-pointer select-none" onClick={() => setView(AppView.DASHBOARD)}>
              <span className="text-blue-600 font-extrabold">Bug</span>Snap
           </div>

           {/* Pill Navigation */}
           <div className="bg-slate-100 dark:bg-[#1e1e1e] p-1 rounded-lg flex gap-1">
             <button 
               onClick={() => setView(AppView.DASHBOARD)}
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${view === AppView.DASHBOARD ? 'bg-white dark:bg-[#272727] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'}`}
             >
               <Home size={14} />
               Dashboard
             </button>
             
             {/* Show "Current Session" if active slides exist */}
             {slides.length > 0 && (
                 <button 
                   onClick={() => setView(AppView.EDITOR)}
                   className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${view === AppView.EDITOR ? 'bg-white dark:bg-[#272727] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'}`}
                 >
                   <PenTool size={14} />
                   Current Session ({slides.length})
                 </button>
             )}

             <button 
               onClick={() => setView(AppView.INTEGRATIONS)}
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${view === AppView.INTEGRATIONS ? 'bg-white dark:bg-[#272727] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'}`}
             >
               <Zap size={14} />
               Integrations
             </button>
           </div>
        </div>
        
        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Floating Trigger (Top Bar shortcut) */}
          {view === AppView.EDITOR && (
             <button 
               onClick={handleFloatingCaptureSession}
               className="text-slate-500 dark:text-zinc-400 hover:bg-blue-50 dark:hover:bg-[#272727] hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-lg transition hidden md:block"
               title="Launch Floating Snap Widget"
             >
               <LayoutTemplate size={18} />
             </button>
          )}
          
          <button 
            onClick={toggleTheme}
            className="text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-[#272727] p-2 rounded-lg transition"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-[#272727] mx-1"></div>
          
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition p-1" title="Logout">
              <LogOut size={18} />
          </button>

          {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-slate-200 dark:border-[#272727]" title={user.name} />
          ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#1e1e1e] flex items-center justify-center text-slate-500 dark:text-zinc-400 font-bold border border-slate-300 dark:border-[#272727]" title={user.name}>
                  {user.name.charAt(0)}
              </div>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {view === AppView.DASHBOARD && (
            <Dashboard 
                onCapture={handleFloatingCaptureSession}
                onRecord={handleVideoRecord}
                onUpload={handleTriggerFileUpload}
            />
        )}
        {view === AppView.INTEGRATIONS && <IntegrationsHub />}
        {view === AppView.EDITOR && slides.length > 0 && (
          <Editor 
            slides={slides}
            activeSlideId={activeSlideId || slides[0].id}
            onSelectSlide={setActiveSlideId}
            onUpdateSlide={(updated) => {
              setSlides(slides.map(s => s.id === updated.id ? updated : s));
            }}
            onDeleteSlide={handleDeleteSlide}
            onAddSlide={handleTriggerFileUpload}
            onCaptureScreen={handleFloatingCaptureSession}
            onRecordVideo={handleVideoRecord}
            onClose={() => setView(AppView.DASHBOARD)}
          />
        )}

        {/* Empty State (Fallback if Editor view is forced but no slides) */}
        {view === AppView.EDITOR && slides.length === 0 && (
             <div className="flex-1 flex items-center justify-center flex-col text-slate-400 dark:text-zinc-500">
                 <p>No active session. Go to Dashboard to start.</p>
                 <button 
                    onClick={() => setView(AppView.DASHBOARD)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
                 >
                    Go to Dashboard
                 </button>
             </div>
        )}
        
        {/* Recording Overlay */}
        {isRecording && (
           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="font-mono font-bold">{new Date(recordingTime * 1000).toISOString().substr(14, 5)}</span>
              <button onClick={stopRecording} className="bg-red-600 hover:bg-red-700 px-4 py-1 rounded text-sm font-bold transition">Stop</button>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;
