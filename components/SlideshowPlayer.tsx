import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize2, Minimize2, AlertTriangle } from 'lucide-react';
import { StorySegment } from '../types';

interface SlideshowPlayerProps {
  segments: StorySegment[];
  onClose: () => void;
  onPlayAudio: (segmentId: string, text: string) => Promise<void>;
  onStopAudio: () => void;
}

const SlideshowPlayer: React.FC<SlideshowPlayerProps> = ({
  segments,
  onClose,
  onPlayAudio,
  onStopAudio
}) => {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const noAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  const segment = segments[currentSegmentIndex];
  const images = segment.generatedImageUrls && segment.generatedImageUrls.length > 0 
    ? segment.generatedImageUrls 
    : [];

  const currentImage = images.length > 0 ? images[currentImageIndex] : undefined;

  // --- FULLSCREEN LOGIC ---
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        playerContainerRef.current?.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
  };

  useEffect(() => {
      const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // --- AUDIO CYCLE MANAGEMENT ---
  useEffect(() => {
      if (noAudioTimeoutRef.current) clearTimeout(noAudioTimeoutRef.current);
      setAudioBlocked(false);
      setMediaError(null);

      const audio = audioRef.current;
      if (!audio) return;

      setCurrentImageIndex(0);
      setIsLoadingAudio(true);

      const handleSourceChange = async () => {
          // Check if we have a valid audio URL
          if (segment.audioUrl && segment.audioUrl.length > 5) {
              try {
                  // Only reload if the source is different to avoid glitches
                  if (audio.src !== segment.audioUrl) {
                      audio.src = segment.audioUrl;
                      audio.load(); // Reset element
                      // Playback will be triggered by onCanPlay
                  } else {
                      // Same source, just ensure we are playing if needed
                      if (isPlaying && audio.paused) {
                          attemptPlay(audio);
                      } else {
                          setIsLoadingAudio(false);
                      }
                  }
              } catch (e) {
                  console.error("Audio Load Error:", e);
                  handleNoAudioFallback("Audio Load Error");
              }
          } else {
              handleNoAudioFallback(); // No audio available for this slide
          }
      };

      const handleNoAudioFallback = (errorMsg?: string) => {
          if (!audio) return;
          audio.pause();
          
          if (errorMsg) setMediaError(errorMsg);
          setIsLoadingAudio(false);
          
          // If playing, start the timer to advance slide
          if (isPlaying) {
              const simulatedDuration = Math.max(5000, segment.text.length * 60); // Slower reading speed
              noAudioTimeoutRef.current = setTimeout(() => {
                  handleSegmentComplete();
              }, simulatedDuration);
          }
      }

      handleSourceChange();

      return () => {
         if (noAudioTimeoutRef.current) clearTimeout(noAudioTimeoutRef.current);
      };
  }, [currentSegmentIndex, segment.audioUrl]);

  // --- PLAY/PAUSE SYNC ---
  const attemptPlay = async (audio: HTMLAudioElement) => {
      if (!audio.src || audio.src === window.location.href) return;
      
      try {
          await audio.play();
          setAudioBlocked(false);
          setMediaError(null);
      } catch (error: any) {
          if (error.name === 'NotAllowedError') {
              setAudioBlocked(true);
              setIsPlaying(false); 
          } else if (error.name !== 'AbortError') {
              console.warn("Playback error:", error);
              setMediaError("Format Error");
              // Don't stop, let the timer takeover in onError
          }
      }
  };
  
  // Watch isPlaying state changes
  useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      if (segment.audioUrl) {
          if (isPlaying) {
              if (audio.readyState >= 3) { // HAVE_FUTURE_DATA
                  attemptPlay(audio);
              }
              // If not ready, onCanPlay will handle it
          } else {
              audio.pause();
          }
      } else {
          // Timer logic for non-audio slides
          if (isPlaying && !noAudioTimeoutRef.current) {
              const simulatedDuration = Math.max(5000, segment.text.length * 60);
              noAudioTimeoutRef.current = setTimeout(() => {
                  handleSegmentComplete();
              }, simulatedDuration);
          } else if (!isPlaying && noAudioTimeoutRef.current) {
              clearTimeout(noAudioTimeoutRef.current);
              noAudioTimeoutRef.current = null;
          }
      }
  }, [isPlaying]); // Removed currentSegmentIndex to prevent race condition

  // --- IMAGE CAROUSEL ---
  useEffect(() => {
     if (!isPlaying || images.length <= 1) return;

     const safeDuration = (segment.audioDuration && Number.isFinite(segment.audioDuration)) ? segment.audioDuration : 10;
     const timePerSlide = (safeDuration * 1000) / images.length;

     const interval = setInterval(() => {
         setCurrentImageIndex(prev => {
             const next = prev + 1;
             return next >= images.length ? 0 : next;
         });
     }, timePerSlide);

     return () => clearInterval(interval);
  }, [currentSegmentIndex, isPlaying, images.length, segment.audioDuration]);

  // --- HANDLERS ---
  const handleSegmentComplete = () => {
      if (currentSegmentIndex < segments.length - 1) {
          setCurrentSegmentIndex(prev => prev + 1);
      } else {
          setIsPlaying(false);
          setShowControls(true);
      }
  };

  const onAudioEnded = () => {
      handleSegmentComplete();
  };

  const onAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      const target = e.target as HTMLAudioElement;
      if (!target.src || target.src === window.location.href) return;
      
      console.warn("Media Error Event:", target.error);
      setIsLoadingAudio(false);
      setMediaError("Audio Unavailable");
      
      // Fallback to timer
      const simulatedDuration = Math.max(5000, segment.text.length * 60);
      noAudioTimeoutRef.current = setTimeout(() => {
          handleSegmentComplete();
      }, simulatedDuration);
  };

  const onCanPlay = () => {
      setIsLoadingAudio(false);
      if (isPlaying && audioRef.current) {
          attemptPlay(audioRef.current);
      }
  };

  const togglePlay = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setIsPlaying(!isPlaying);
      flashControls();
  };

  const handleNext = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (currentSegmentIndex < segments.length - 1) {
          setCurrentSegmentIndex(prev => prev + 1);
      }
  };

  const handlePrev = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (currentSegmentIndex > 0) {
          setCurrentSegmentIndex(prev => prev - 1);
      }
  };

  const handleClose = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsPlaying(false);
      onStopAudio();
      onClose();
  };

  const flashControls = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
          if (isPlaying) setShowControls(false);
      }, 2500);
  };

  const overallProgress = ((currentSegmentIndex) / (segments.length - 1 || 1)) * 100;

  return createPortal(
    <div 
        ref={playerContainerRef}
        className="fixed inset-0 z-[9999] bg-black text-white w-full h-[100dvh] overflow-hidden flex flex-col font-sans select-none"
        onClick={() => togglePlay()}
    >
      <audio 
          ref={audioRef}
          onEnded={onAudioEnded}
          onError={onAudioError}
          onCanPlay={onCanPlay}
          className="hidden"
          preload="auto"
      />

      {/* VISUAL LAYER */}
      <div className="absolute inset-0 z-0 bg-slate-900">
        {currentImage ? (
             <div className="absolute inset-0 animate-fade-in">
                 <div 
                    className="absolute inset-0 blur-3xl opacity-50"
                    style={{ backgroundImage: `url(${currentImage})`, backgroundSize: 'cover' }}
                 />
                 <img 
                    key={`${currentSegmentIndex}-${currentImageIndex}`}
                    src={currentImage} 
                    alt="Scene"
                    className="w-full h-full object-contain md:object-cover animate-ken-burns"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/30" />
             </div>
        ) : (
            <div className="h-full w-full flex items-center justify-center bg-black">
                <div className="text-slate-500 animate-pulse text-sm tracking-widest uppercase">Visual Loading...</div>
            </div>
        )}
      </div>

      {/* ERROR / STATUS NOTIFICATIONS */}
      {mediaError && isPlaying && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-red-500/80 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 animate-bounce">
              <AlertTriangle className="w-4 h-4" />
              {mediaError} - Skipping...
          </div>
      )}

      {/* HEADER */}
      <div className={`absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-start transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex gap-1 flex-1 max-w-md">
             {segments.map((_, idx) => (
                 <div key={idx} className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden mx-0.5">
                     <div className={`h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all duration-300 ${idx <= currentSegmentIndex ? 'w-full' : 'w-0'}`} />
                 </div>
             ))}
          </div>
          
          <div className="flex items-center gap-2">
            <button
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="ml-4 bg-black/40 backdrop-blur-md rounded-full p-2 text-white/90 hover:bg-white/10 transition-colors"
            >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button 
                onClick={handleClose}
                className="bg-black/40 backdrop-blur-md rounded-full p-2 text-white/90 hover:bg-white/10 transition-colors"
            >
                <X className="w-5 h-5" />
            </button>
          </div>
      </div>

      {/* CENTER STATE OVERLAY */}
      {!isPlaying && !audioBlocked && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-full border border-white/20 shadow-2xl animate-fade-in">
                  <Play className="w-12 h-12 fill-white text-white ml-2" />
              </div>
          </div>
      )}

      {/* BLOCKED AUDIO OVERLAY - MUST BE CLICKED */}
      {audioBlocked && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-md">
             <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full font-bold text-lg shadow-xl animate-bounce flex items-center gap-3 transform hover:scale-105 transition-transform"
             >
                <Volume2 className="w-6 h-6" />
                Tap to Enable Audio
             </button>
          </div>
      )}
      
      {isLoadingAudio && isPlaying && !mediaError && (
           <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 backdrop-blur-sm px-6 py-3 rounded-full border border-white/10 animate-pulse flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Buffering Audio...</span>
              </div>
          </div>
      )}

      {/* TOUCH ZONES */}
      <div className="absolute inset-y-0 left-0 w-[20%] z-20 cursor-w-resize" onClick={handlePrev} />
      <div className="absolute inset-y-0 right-0 w-[20%] z-20 cursor-e-resize" onClick={handleNext} />

      {/* SUBTITLE AREA */}
      <div className="absolute bottom-16 left-0 right-0 px-6 z-40 flex flex-col items-center pointer-events-none pb-4">
          <div className={`mb-4 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
               <span className="bg-black/60 backdrop-blur-md text-white/90 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10 shadow-lg">
                 Scene {currentSegmentIndex + 1} • {segment.timeOfDay}
               </span>
          </div>

          <div className="w-full max-w-4xl text-center">
              <div className="inline-block bg-black/60 backdrop-blur-md text-white/90 text-sm md:text-base leading-relaxed px-6 py-4 rounded-xl shadow-2xl border border-white/5 font-serif">
                 {segment.text}
              </div>
          </div>
      </div>

      {/* BOTTOM PROGRESS BAR */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 z-50">
          <div 
             className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-300 ease-linear"
             style={{ width: `${overallProgress}%` }}
          />
      </div>

    </div>,
    document.body
  );
};

export default SlideshowPlayer;