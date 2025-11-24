
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
     const success = await onSnap();
     if (success) {
         setFlashing(true);
         setTimeout(() => setFlashing(false), 500);
     }
  };

  return (
    <>
    {/* Critical Style Injection for PiP Window */}
    <style dangerouslySetInnerHTML={{__html: `
      body { margin: 0; padding: 0; background-color: #0f0f0f; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }
      * { box-sizing: border-box; }
    `}} />
    <div 
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f0f',
        color: 'white',
        opacity: isSnapping ? 0 : 1,
        transition: 'opacity 150ms ease-in-out'
      }}
    >
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 24px',
          width: '100%',
          justifyContent: 'space-between',
          maxWidth: '600px'
        }}
      >
        {/* Brand / Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <div 
             style={{
               width: '40px',
               height: '40px',
               borderRadius: '12px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               backgroundColor: flashing ? '#22c55e' : '#2563eb',
               color: 'white',
               transform: flashing ? 'scale(1.1)' : 'scale(1)',
               transition: 'all 150ms'
             }}
           >
              {flashing ? <Check size={24} /> : <Aperture size={24} />}
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
             <span style={{ fontWeight: '700', fontSize: '14px', color: '#e4e4e7' }}>BugSnap Active</span>
             <span style={{ fontSize: '12px', color: '#a1a1aa', fontFamily: 'monospace' }}>{slideCount} screenshots</span>
           </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <button 
             onClick={handleSnap}
             disabled={isSnapping}
             style={{
               backgroundColor: 'white',
               color: '#18181b',
               padding: '10px 24px',
               borderRadius: '8px',
               fontWeight: '700',
               fontSize: '14px',
               display: 'flex',
               alignItems: 'center',
               gap: '8px',
               border: 'none',
               cursor: isSnapping ? 'not-allowed' : 'pointer',
               opacity: isSnapping ? 0.6 : 1,
               boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
             }}
           >
             <Camera size={18} />
             SNAP
           </button>
           
           <div style={{ width: '1px', height: '32px', backgroundColor: '#3f3f46', margin: '0 8px' }}></div>

           <button 
             onClick={onStop}
             style={{
               color: '#ef4444',
               backgroundColor: 'rgba(69, 10, 10, 0.3)',
               padding: '10px',
               borderRadius: '8px',
               border: 'none',
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center'
             }}
             title="Finish Session"
           >
             <StopCircle size={20} />
           </button>
        </div>
      </div>
    </div>
    </>
  );
};

// --- Modal for Restricted Iframe Environments ---
const RestrictedModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in">
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

  // Toggle Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('bugsnap_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Auth Effect
  useEffect(() => {
      // If we have a user and are on LOGIN view, go to DASHBOARD
      if (user && view === AppView.LOGIN) {
          setView(AppView.DASHBOARD);
      }
  }, [user, view]);

  // Persist Slides
  useEffect(() => {
      localStorage.setItem('bugsnap_slides', JSON.stringify(slides));
  }, [slides]);

  const [isDragging, setIsDragging] = useState(false);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [isRestrictedModalOpen, setIsRestrictedModalOpen] = useState(false);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
      setIsInIframe(window.self !== window.top);
      setOrigin(window.location.origin);
  }, []);

  // --- Handlers ---

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Demo Login
      const demoUser: User = {
          id: 'demo-user',
          name: 'QA Tester',
          email: 'qa@bugsnap.dev',
          avatar: 'https://ui-avatars.com/api/?name=QA+Tester&background=random',
          isDemo: true
      };
      setUser(demoUser);
      localStorage.setItem('bugsnap_user', JSON.stringify(demoUser));
      setView(AppView.DASHBOARD);
      addToast("Welcome back!", "success");
  };

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem('bugsnap_user');
      setView(AppView.LOGIN);
  };

  // --- Capture Logic ---

  const handleStopCapture = useCallback(() => {
      if (pipWindow) {
          pipWindow.close();
      }
      setPipWindow(null);
      setIsRecording(false);
      setView(AppView.EDITOR); // Go to editor after capture
  }, [pipWindow]);

  const handleSnap = useCallback(async (): Promise<boolean> => {
      setIsSnapping(true);
      try {
          // Wait for opacity transition
          await new Promise(r => setTimeout(r, 100));

          const stream = await navigator.mediaDevices.getDisplayMedia({
              video: { displaySurface: "browser" },
              audio: false,
          });
          
          const track = stream.getVideoTracks()[0];
          const imageCapture = new ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          
          // Convert to Blob/DataURL
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(bitmap, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              
              // Add Slide
              const newSlide: Slide = {
                  id: Date.now().toString(),
                  type: 'image',
                  src: dataUrl,
                  name: `Screenshot ${slides.length + 1}`,
                  annotations: [],
                  createdAt: Date.now()
              };
              setSlides(prev => [...prev, newSlide]);
              setActiveSlideId(newSlide.id);
          }

          track.stop(); // Stop the capture stream
          setIsSnapping(false);
          return true;
      } catch (err) {
          console.error("Snap failed:", err);
          setIsSnapping(false);
          return false;
      }
  }, [slides.length]);

  const startCaptureSession = async () => {
      if (isInIframe) {
          setIsRestrictedModalOpen(true);
          return;
      }

      try {
          // Request PiP Window
          if (!window.documentPictureInPicture) {
              addToast("Your browser does not support Document PiP API.", "error");
              return;
          }

          const win = await window.documentPictureInPicture.requestWindow({
              width: 300,
              height: 120
          });

          // Copy styles? We use inline styles in widget for reliability, 
          // but let's clear the body margin just in case
          win.document.body.style.margin = "0";
          win.document.body.style.backgroundColor = "#0f0f0f";

          // Handle Close
          win.addEventListener('pagehide', () => {
              setPipWindow(null);
              setIsRecording(false);
              setView(AppView.EDITOR);
          });

          setPipWindow(win);
          setIsRecording(true);
          // Render widget into PiP
          // We rely on the effect below to render via Portal
          
      } catch (err) {
          console.error("Failed to open PiP", err);
          addToast("Failed to launch floating widget.", "error");
      }
  };

  // Render Widget into PiP Window
  useEffect(() => {
      if (pipWindow) {
          const root = ReactDOM.createRoot(pipWindow.document.body);
          root.render(
              <FloatingSnapWidget 
                 onSnap={handleSnap} 
                 onStop={handleStopCapture} 
                 slideCount={slides.length}
                 isSnapping={isSnapping}
              />
          );
          
          // Cleanup on unmount or window close handled by 'pagehide' listener mostly,
          // but ideally we should unmount root. 
          // For simplicity in this structure, we just let the window close destroy it.
      }
  }, [pipWindow, slides.length, isSnapping, handleSnap, handleStopCapture]);

  // --- File Upload ---
  const handleUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.multiple = true;
      input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files) {
              const newSlides: Slide[] = [];
              Array.from(files).forEach((file, i) => {
                   const url = URL.createObjectURL(file);
                   newSlides.push({
                       id: Date.now().toString() + i,
                       type: file.type.startsWith('video') ? 'video' : 'image',
                       src: url,
                       name: file.name,
                       annotations: [],
                       createdAt: Date.now()
                   });
              });
              setSlides(prev => [...prev, ...newSlides]);
              if (newSlides.length > 0) setActiveSlideId(newSlides[0].id);
              setView(AppView.EDITOR);
          }
      };
      input.click();
  };

  // --- Render Views ---

  if (view === AppView.LOGIN) {
      return (
          <div className="flex h-screen w-screen bg-slate-50 dark:bg-[#0f0f0f] text-slate-900 dark:text-white overflow-hidden relative">
             <div className="absolute top-4 right-4 z-10">
                 <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-[#272727]">
                     {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                 </button>
             </div>
             
             <div className="m-auto w-full max-w-md p-8">
                <div className="flex justify-center mb-8">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 transform -rotate-6">
                        <Bug size={40} className="text-white" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-center mb-2">BugSnap</h1>
                <p className="text-center text-slate-500 dark:text-zinc-400 mb-8">AI-Powered Visual Bug Reporting</p>
                
                <div className="bg-white dark:bg-[#1e1e1e] p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-[#272727]">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Email</label>
                            <input type="email" placeholder="qa@bugsnap.dev" className="w-full p-3 rounded-lg border border-slate-200 dark:border-[#3f3f3f] bg-slate-50 dark:bg-[#121212] focus:ring-2 focus:ring-blue-500 outline-none transition" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Password</label>
                            <input type="password" placeholder="••••••••" className="w-full p-3 rounded-lg border border-slate-200 dark:border-[#3f3f3f] bg-slate-50 dark:bg-[#121212] focus:ring-2 focus:ring-blue-500 outline-none transition" />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-500/30">
                            Sign In
                        </button>
                        <div className="relative my-6">
                             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-[#272727]"></div></div>
                             <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-[#1e1e1e] px-2 text-slate-400">Or continue with</span></div>
                        </div>
                         <button type="button" onClick={handleLogin} className="w-full bg-white dark:bg-[#272727] border border-slate-200 dark:border-[#3f3f3f] hover:bg-slate-50 dark:hover:bg-[#333] text-slate-700 dark:text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                            <span className="font-bold">Google (Demo)</span>
                        </button>
                    </form>
                </div>
             </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-[#0f0f0f] text-slate-900 dark:text-white overflow-hidden transition-colors">
      <RestrictedModal isOpen={isRestrictedModalOpen} onClose={() => setIsRestrictedModalOpen(false)} />
      
      {/* App Header */}
      <header className="h-16 bg-white dark:bg-[#1e1e1e] border-b border-slate-200 dark:border-[#272727] flex items-center justify-between px-6 shrink-0 z-10 transition-colors">
         <div className="flex items-center gap-8">
             <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500">
                 <Bug size={24} />
                 <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">BugSnap</span>
             </div>
             
             {/* Nav */}
             <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#272727] p-1 rounded-lg">
                 <button 
                   onClick={() => setView(AppView.DASHBOARD)} 
                   className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === AppView.DASHBOARD ? 'bg-white dark:bg-[#0f0f0f] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                 >
                   Dashboard
                 </button>
                 <button 
                   onClick={() => setView(AppView.EDITOR)} 
                   className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === AppView.EDITOR ? 'bg-white dark:bg-[#0f0f0f] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                 >
                   Editor
                 </button>
                 <button 
                   onClick={() => setView(AppView.INTEGRATIONS)} 
                   className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === AppView.INTEGRATIONS ? 'bg-white dark:bg-[#0f0f0f] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                 >
                   Integrations
                 </button>
             </div>
         </div>

         <div className="flex items-center gap-4">
             {/* Open in New Tab (For Iframe bypass) */}
             {isInIframe && (
                 <a 
                   href={origin} 
                   target="_blank" 
                   rel="noreferrer"
                   className="hidden md:flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-900/30"
                 >
                    <ExternalLink size={14} /> Open Standalone
                 </a>
             )}

             <button 
               onClick={() => setIsDarkMode(!isDarkMode)} 
               className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
               title="Toggle Theme"
             >
                 {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>

             {user && (
                 <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-[#272727]">
                     <div className="text-right hidden sm:block">
                         <div className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</div>
                         <div className="text-xs text-slate-500 dark:text-zinc-400">{user.email}</div>
                     </div>
                     <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full border border-slate-200 dark:border-[#3f3f3f]" />
                     <button onClick={handleLogout} className="text-slate-400 hover:text-red-600 p-1 transition" title="Log Out">
                         <LogOut size={18} />
                     </button>
                 </div>
             )}
         </div>
      </header>
      
      {/* Main Content Area */}
      {view === AppView.DASHBOARD && (
          <Dashboard 
             onCapture={startCaptureSession} 
             onRecord={() => addToast("Video recording coming soon", "info")}
             onUpload={handleUpload}
          />
      )}
      
      {view === AppView.EDITOR && (
          <Editor 
             slides={slides}
             activeSlideId={activeSlideId || ''}
             onSelectSlide={setActiveSlideId}
             onUpdateSlide={(s) => setSlides(prev => prev.map(old => old.id === s.id ? s : old))}
             onDeleteSlide={(id) => {
                 const newSlides = slides.filter(s => s.id !== id);
                 setSlides(newSlides);
                 if (newSlides.length > 0 && activeSlideId === id) setActiveSlideId(newSlides[0].id);
                 if (newSlides.length === 0) setActiveSlideId(null);
             }}
             onAddSlide={handleUpload}
             onCaptureScreen={startCaptureSession}
             onRecordVideo={() => addToast("Video recording coming soon", "info")}
             onClose={() => setView(AppView.DASHBOARD)}
          />
      )}
      
      {view === AppView.INTEGRATIONS && (
          <IntegrationsHub />
      )}

    </div>
  );
};

export default App;
