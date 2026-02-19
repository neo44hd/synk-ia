import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  FileText, 
  Calendar, 
  MessageSquare, 
  Users,
  LogIn,
  LogOut as LogOutIcon,
  CheckCircle2,
  Zap,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import WorkerDocuments from "../components/worker/WorkerDocuments";
import WorkerVacations from "../components/worker/WorkerVacations";
import WorkerChat from "../components/worker/WorkerChat";
import WorkerGroupChat from "../components/worker/WorkerGroupChat";
import InstallTutorial from "../components/worker/InstallTutorial";
import { Download, Smartphone } from "lucide-react";

export default function WorkerInterface() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [user, setUser] = useState(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showVacations, setShowVacations] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [nextEvent, setNextEvent] = useState(null);

  const queryClient = useQueryClient();

  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Intenta cargar sesión del portal primero
        const portalUser = localStorage.getItem('portal_employee');
        if (portalUser) {
          setUser(JSON.parse(portalUser));
        } else {
          // Fallback a autenticación de sistema si no hay portal
          const currentUser = await base44.auth.me();
          if (currentUser) setUser(currentUser);
          else navigate(createPageUrl('PortalLogin'));
        }
      } catch (error) {
        console.error('Error loading user:', error);
        navigate(createPageUrl('PortalLogin'));
      }
    };
    loadUser();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calcular próximo evento (Entrada/Salida)
  useEffect(() => {
    if (!user?.shift_start || !user?.shift_end) return;
    
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    const [startH, startM] = user.shift_start.split(':').map(Number);
    const startVal = startH + startM / 60;
    
    const [endH, endM] = user.shift_end.split(':').map(Number);
    const endVal = endH + endM / 60;

    if (currentHour < startVal) {
      setNextEvent({ type: 'ENTRADA', time: user.shift_start, diff: startVal - currentHour });
    } else if (currentHour < endVal) {
      setNextEvent({ type: 'SALIDA', time: user.shift_end, diff: endVal - currentHour });
    } else {
      setNextEvent(null); // Turno terminado
    }
  }, [currentTime, user]);

  const handleLogout = () => {
    localStorage.removeItem('portal_employee');
    navigate(createPageUrl('PortalLogin'));
  };

  const { data: todayTimesheet } = useQuery({
    queryKey: ['today-timesheet'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const timesheets = await base44.entities.Timesheet.list('-created_date', 10);
      return timesheets.find(t => 
        t.date === today && 
        (t.user_id === user?.id || t.user_name === user?.full_name)
      );
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalización no soportada"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      let coords = {};
      try {
        const pos = await getLocation();
        coords = { 
          latitude: pos.latitude, 
          longitude: pos.longitude, 
          accuracy: pos.accuracy 
        };
      } catch (e) {
        console.warn("No se pudo obtener ubicación:", e);
        toast.warning("⚠️ No se pudo detectar ubicación. Se registrará sin GPS.");
      }

      const res = await base44.functions.invoke('clockIn', coords);
      if (res.data.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-timesheet'] });
      toast.success('✅ ENTRADA REGISTRADA');
    },
    onError: (err) => {
      toast.error(err.message || "Error al fichar entrada");
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      let coords = {};
      try {
        const pos = await getLocation();
        coords = { 
          latitude: pos.latitude, 
          longitude: pos.longitude, 
          accuracy: pos.accuracy 
        };
      } catch (e) {
        console.warn("No se pudo obtener ubicación:", e);
      }

      const res = await base44.functions.invoke('clockOut', {
        ...coords,
        timesheet_id: todayTimesheet.id
      });
      if (res.data.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-timesheet'] });
      toast.success('✅ SALIDA REGISTRADA');
    },
    onError: (err) => {
      toast.error(err.message || "Error al fichar salida");
    }
  });

  const hasCheckedIn = todayTimesheet && todayTimesheet.check_in;
  const hasCheckedOut = todayTimesheet && todayTimesheet.check_out;

  const handleCenterButton = () => {
    if (!hasCheckedIn) {
      checkInMutation.mutate();
    } else if (!hasCheckedOut) {
      checkOutMutation.mutate();
    }
  };

  return (
    <div className="h-screen bg-black relative overflow-hidden">
      {/* Animated Grid Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridScroll 20s linear infinite'
        }}></div>
      </div>

      {/* Holographic Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0" style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.1) 2px, rgba(0, 255, 255, 0.1) 4px)',
          animation: 'scanlines 8s linear infinite'
        }}></div>
      </div>

      {/* Animated Background Particles */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-20 w-2 h-2 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '0s' }}></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-40 w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 right-20 w-2 h-2 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '3s' }}></div>
      </div>

      <style>{`
        @keyframes gridScroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(50px); }
        }
        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
        @keyframes hexPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* TOP HUD - User Info */}
      <div className="absolute top-6 left-6 z-20">
        <div className="relative">
          {/* Hexagonal Frame */}
          <svg width="320" height="120" viewBox="0 0 320 120" className="absolute -left-2 -top-2">
            <path d="M10,0 L310,0 L320,10 L320,110 L310,120 L10,120 L0,110 L0,10 Z" 
                  fill="rgba(0, 0, 0, 0.8)" 
                  stroke="url(#gradient1)" 
                  strokeWidth="2"/>
            <defs>
              <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(6, 182, 212)" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.8"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              <p className="text-cyan-400 text-xs font-mono tracking-wider">OPERATOR</p>
            </div>
            <p className="text-white text-2xl font-bold tracking-wide">{user?.full_name}</p>
            <p className="text-cyan-300 text-sm font-mono mt-1">{user?.position || 'CREW MEMBER'}</p>
            <div className="flex items-center gap-2 mt-3">
              <Activity className="w-4 h-4 text-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-mono">SYSTEMS ONLINE</span>
            </div>
            
            {nextEvent && (
              <div className="mt-4 pt-4 border-t border-cyan-500/20">
                <p className="text-xs text-cyan-400 font-mono mb-1">PRÓXIMO EVENTO:</p>
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">{nextEvent.type}</span>
                  <span className="text-yellow-400 font-mono text-lg">{nextEvent.time}</span>
                </div>
                {nextEvent.diff < 1 && nextEvent.diff > 0 && (
                  <p className="text-xs text-red-400 mt-1 animate-pulse">¡EN MENOS DE 1H!</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-2 ml-2 mt-4">
          {/* APP INSTALL BUTTON */}
          <button 
            onClick={() => setShowInstall(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-900/30 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-900/50 transition-all group w-fit"
          >
            <Smartphone className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-mono font-bold">INSTALL APP</span>
          </button>
          
          {/* LOGOUT BUTTON */}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-900/50 transition-all group w-fit"
          >
            <LogOutIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-mono font-bold">LOGOUT</span>
          </button>
        </div>
      </div>

      {/* TOP RIGHT HUD - Status */}
      <div className="absolute top-6 right-6 z-20">
        <div className="relative">
          <svg width="280" height="120" viewBox="0 0 280 120" className="absolute -left-2 -top-2">
            <path d="M0,10 L10,0 L270,0 L280,10 L280,110 L270,120 L10,120 L0,110 Z" 
                  fill="rgba(0, 0, 0, 0.8)" 
                  stroke="url(#gradient2)" 
                  strokeWidth="2"/>
            <defs>
              <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(147, 51, 234)" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.8"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="relative p-6 text-right">
            <div className="flex items-center justify-end gap-2 mb-2">
              <p className="text-purple-400 text-xs font-mono tracking-wider">STATUS</p>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{
                backgroundColor: hasCheckedOut ? '#4ade80' : hasCheckedIn ? '#fbbf24' : '#94a3b8'
              }}></div>
            </div>
            <p className="text-white text-xl font-bold tracking-wide">
              {hasCheckedOut ? 'JORNADA COMPLETA' : hasCheckedIn ? 'EN SERVICIO' : 'STANDBY'}
            </p>
            {hasCheckedIn && !hasCheckedOut && (
              <p className="text-yellow-400 text-sm font-mono mt-2">
                ENTRADA: {todayTimesheet.check_in}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 mt-3">
              <span className="text-purple-400 text-xs font-mono">MISSION</span>
              <Zap className="w-4 h-4 text-purple-400 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* CORNER HEXAGONAL BUTTONS */}
      {/* TOP LEFT */}
      <div className="absolute top-40 left-8 z-10" style={{ perspective: '1000px' }}>
        <Button
          onClick={() => setShowDocuments(true)}
          className="relative w-36 h-36 bg-transparent border-0 group"
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            <polygon points="50,5 85,25 85,75 50,95 15,75 15,25"
                     fill="rgba(59, 130, 246, 0.1)"
                     stroke="rgb(59, 130, 246)"
                     strokeWidth="2"
                     className="group-hover:fill-[rgba(59,130,246,0.3)] transition-all duration-300"/>
          </svg>
          <div className="relative flex flex-col items-center justify-center">
            <FileText className="w-10 h-10 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-blue-400 text-xs font-mono tracking-wider">DOCS</span>
          </div>
        </Button>
      </div>

      {/* TOP RIGHT */}
      <div className="absolute top-40 right-8 z-10">
        <Button
          onClick={() => setShowVacations(true)}
          className="relative w-36 h-36 bg-transparent border-0 group"
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            <polygon points="50,5 85,25 85,75 50,95 15,75 15,25"
                     fill="rgba(168, 85, 247, 0.1)"
                     stroke="rgb(168, 85, 247)"
                     strokeWidth="2"
                     className="group-hover:fill-[rgba(168,85,247,0.3)] transition-all duration-300"/>
          </svg>
          <div className="relative flex flex-col items-center justify-center">
            <Calendar className="w-10 h-10 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-purple-400 text-xs font-mono tracking-wider">LEAVE</span>
          </div>
        </Button>
      </div>

      {/* BOTTOM LEFT */}
      <div className="absolute bottom-8 left-8 z-10">
        <Button
          onClick={() => setShowChat(true)}
          className="relative w-36 h-36 bg-transparent border-0 group"
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            <polygon points="50,5 85,25 85,75 50,95 15,75 15,25"
                     fill="rgba(34, 197, 94, 0.1)"
                     stroke="rgb(34, 197, 94)"
                     strokeWidth="2"
                     className="group-hover:fill-[rgba(34,197,94,0.3)] transition-all duration-300"/>
          </svg>
          <div className="relative flex flex-col items-center justify-center">
            <MessageSquare className="w-10 h-10 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-green-400 text-xs font-mono tracking-wider">ADMIN</span>
          </div>
        </Button>
      </div>

      {/* BOTTOM RIGHT */}
      <div className="absolute bottom-8 right-8 z-10">
        <Button
          onClick={() => setShowGroupChat(true)}
          className="relative w-36 h-36 bg-transparent border-0 group"
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            <polygon points="50,5 85,25 85,75 50,95 15,75 15,25"
                     fill="rgba(251, 146, 60, 0.1)"
                     stroke="rgb(251, 146, 60)"
                     strokeWidth="2"
                     className="group-hover:fill-[rgba(251,146,60,0.3)] transition-all duration-300"/>
          </svg>
          <div className="relative flex flex-col items-center justify-center">
            <Users className="w-10 h-10 text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-orange-400 text-xs font-mono tracking-wider">CREW</span>
          </div>
        </Button>
      </div>

      {/* CENTRAL HOLOGRAPHIC CONSOLE */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
        <div className="relative">
          {/* Outer Hexagonal Ring */}
          <svg width="480" height="480" viewBox="0 0 480 480" className="absolute -left-10 -top-10">
            <defs>
              <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={hasCheckedOut ? '#4ade80' : hasCheckedIn ? '#ef4444' : '#06b6d4'} stopOpacity="1">
                  <animate attributeName="stop-color" 
                           values={hasCheckedOut ? '#4ade80;#22c55e;#4ade80' : hasCheckedIn ? '#ef4444;#dc2626;#ef4444' : '#06b6d4;#0891b2;#06b6d4'} 
                           dur="3s" 
                           repeatCount="indefinite"/>
                </stop>
                <stop offset="100%" stopColor={hasCheckedOut ? '#22c55e' : hasCheckedIn ? '#dc2626' : '#0891b2'} stopOpacity="1"/>
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Rotating Hexagon */}
            <polygon points="240,20 420,120 420,360 240,460 60,360 60,120"
                     fill="none"
                     stroke="url(#mainGradient)"
                     strokeWidth="3"
                     filter="url(#glow)"
                     opacity="0.6">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 240 240"
                to="360 240 240"
                dur="20s"
                repeatCount="indefinite"/>
            </polygon>

            {/* Inner Hexagon */}
            <polygon points="240,60 380,140 380,340 240,420 100,340 100,140"
                     fill="rgba(0, 0, 0, 0.8)"
                     stroke="url(#mainGradient)"
                     strokeWidth="2"
                     filter="url(#glow)"/>
          </svg>

          {/* Main Control Button */}
          <button
            onClick={handleCenterButton}
            disabled={hasCheckedOut}
            className={`
              relative w-96 h-96 rounded-full
              flex flex-col items-center justify-center
              transition-all duration-500
              ${hasCheckedOut ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-105'}
            `}
            style={{
              background: `radial-gradient(circle, 
                ${hasCheckedOut ? 'rgba(74, 222, 128, 0.2)' : hasCheckedIn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(6, 182, 212, 0.2)'} 0%, 
                rgba(0, 0, 0, 0.9) 70%)`
            }}
          >
            {/* Holographic Clock */}
            <div className="text-center mb-8">
              <div className="relative">
                <div className={`text-8xl font-bold font-mono tracking-wider ${
                  hasCheckedOut ? 'text-green-400' : hasCheckedIn ? 'text-red-400' : 'text-cyan-400'
                }`} style={{
                  textShadow: `0 0 20px ${hasCheckedOut ? '#4ade80' : hasCheckedIn ? '#ef4444' : '#06b6d4'}`
                }}>
                  {format(currentTime, 'HH:mm')}
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-full">
                  <div className={`text-xl font-mono tracking-[0.5em] ${
                    hasCheckedOut ? 'text-green-400' : hasCheckedIn ? 'text-red-400' : 'text-cyan-400'
                  }`}>
                    {format(currentTime, 'ss')}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Icon & Text */}
            <div className="mt-12">
              {hasCheckedOut ? (
                <div className="flex flex-col items-center animate-pulse">
                  <CheckCircle2 className="w-24 h-24 text-green-400 mb-4" style={{
                    filter: 'drop-shadow(0 0 10px #4ade80)'
                  }} />
                  <span className="text-green-400 font-bold text-2xl tracking-widest font-mono">
                    MISSION COMPLETE
                  </span>
                </div>
              ) : hasCheckedIn ? (
                <div className="flex flex-col items-center">
                  <LogOutIcon className="w-24 h-24 text-red-400 mb-4 animate-pulse" style={{
                    filter: 'drop-shadow(0 0 10px #ef4444)'
                  }} />
                  <span className="text-red-400 font-bold text-2xl tracking-widest font-mono">
                    END SHIFT
                  </span>
                  <span className="text-red-300 text-sm font-mono mt-3 opacity-75">
                    PRESS TO LOGOUT
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <LogIn className="w-24 h-24 text-cyan-400 mb-4 animate-pulse" style={{
                    filter: 'drop-shadow(0 0 10px #06b6d4)'
                  }} />
                  <span className="text-cyan-400 font-bold text-2xl tracking-widest font-mono">
                    START SHIFT
                  </span>
                  <span className="text-cyan-300 text-sm font-mono mt-3 opacity-75">
                    PRESS TO LOGIN
                  </span>
                </div>
              )}
            </div>

            {/* Energy Rings */}
            {!hasCheckedOut && (
              <>
                <div className="absolute inset-0 border-2 rounded-full animate-ping" style={{
                  borderColor: hasCheckedIn ? '#ef4444' : '#06b6d4',
                  animationDuration: '2s'
                }}></div>
                <div className="absolute inset-8 border rounded-full animate-ping" style={{
                  borderColor: hasCheckedIn ? '#ef4444' : '#06b6d4',
                  animationDuration: '2.5s',
                  animationDelay: '0.5s'
                }}></div>
              </>
            )}
          </button>
        </div>
      </div>

      {/* BOTTOM CENTER HUD - Date Display */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="relative">
          <svg width="500" height="80" viewBox="0 0 500 80" className="absolute -left-2 -top-2">
            <path d="M10,0 L490,0 L500,10 L500,70 L490,80 L10,80 L0,70 L0,10 Z" 
                  fill="rgba(0, 0, 0, 0.8)" 
                  stroke="url(#gradient3)" 
                  strokeWidth="2"/>
            <defs>
              <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(6, 182, 212)" stopOpacity="0.8"/>
                <stop offset="50%" stopColor="rgb(168, 85, 247)" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="rgb(6, 182, 212)" stopOpacity="0.8"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="relative px-8 py-5 text-center">
            <p className="text-cyan-400 text-xl font-mono tracking-[0.3em] font-bold uppercase">
              {format(currentTime, "EEEE, d MMMM yyyy")}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
              <span className="text-cyan-300 text-xs font-mono tracking-widest">STARDATE {format(currentTime, 'yyyyMMdd')}</span>
              <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDocuments && <WorkerDocuments onClose={() => setShowDocuments(false)} user={user} />}
      {showVacations && <WorkerVacations onClose={() => setShowVacations(false)} user={user} />}
      {showChat && <WorkerChat onClose={() => setShowChat(false)} user={user} />}
      {showGroupChat && <WorkerGroupChat onClose={() => setShowGroupChat(false)} user={user} />}
      {showInstall && <InstallTutorial onClose={() => setShowInstall(false)} />}
    </div>
  );
}