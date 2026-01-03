
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Maximize2, GitBranch, Volume2, ChevronRight } from 'lucide-react';
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
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [beatIndex, setBeatIndex] = useState(0); // 0 to 3
  const [hasStarted, setHasStarted] = useState(false);
  const [isWaitingForChoice, setIsWaitingForChoice] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeSegment = segments.find(s => s.id === activeSegmentId);

  // Start logic
  const startStory = () => {
    if (segments.length > 0) {
        setActiveSegmentId(segments[0].id);
        setBeatIndex(0);
        setHasStarted(true);
    }
  };

  // Audio effect
  useEffect(() => {
      if (!hasStarted || !activeSegment || beatIndex !== 0) return;

      const playSegmentAudio = async () => {
          if (activeSegment.audioUrl) {
              if (audioRef.current) {
                  audioRef.current.src = activeSegment.audioUrl;
                  try {
                    await audioRef.current.play();
                  } catch (e) {
                    console.warn("Autoplay prevented", e);
                  }
              }
          } else {
              if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.src = "";
              }
          }
      };
      playSegmentAudio();
  }, [activeSegmentId, beatIndex, hasStarted, activeSegment]);

  // Timer logic
  useEffect(() => {
    if (!hasStarted || !activeSegment || isWaitingForChoice) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);

    // Determine duration based on text length of current beat
    let duration = 3000;
    
    // Get current beat data to check text length
    let currentCaption = "";
    if (activeSegment.panels && activeSegment.panels[beatIndex]) {
        currentCaption = activeSegment.panels[beatIndex].caption;
    } else if (beatIndex === 0) {
        currentCaption = activeSegment.text;
    }

    if (currentCaption) {
        duration = Math.max(3000, currentCaption.length * 80);
    } else {
        duration = 2500; // Fast silent beat
    }

    intervalRef.current = setInterval(() => {
        if (beatIndex < 3) {
            setBeatIndex(prev => prev + 1);
        } else {
            // End of segment (after 4th beat)
            // Check for Choices
            if (activeSegment.choices && activeSegment.choices.length > 0) {
                setIsWaitingForChoice(true);
                if (audioRef.current) audioRef.current.pause(); // Stop audio when waiting
            } else {
                // Determine next segment
                let nextId = activeSegment.nextSegmentId;
                
                // Fallback for linear if no ID
                if (!nextId) {
                    const currentIndex = segments.findIndex(s => s.id === activeSegment.id);
                    if (currentIndex !== -1 && currentIndex < segments.length - 1) {
                        nextId = segments[currentIndex + 1].id;
                    }
                }

                if (nextId) {
                    const nextSeg = segments.find(s => s.id === nextId);
                    if (nextSeg) {
                        setActiveSegmentId(nextId);
                        setBeatIndex(0);
                    } else {
                        onStopAudio();
                        onClose(); // End of story
                    }
                } else {
                    onStopAudio();
                    onClose(); // End of story
                }
            }
        }
    }, duration);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasStarted, activeSegment, beatIndex, isWaitingForChoice, segments, onClose, onStopAudio]);


  const handleChoiceClick = (targetId: string) => {
      const targetSeg = segments.find(s => s.id === targetId);
      if (targetSeg) {
          setIsWaitingForChoice(false);
          setActiveSegmentId(targetId);
          setBeatIndex(0);
      } else {
          console.error("Target segment not found:", targetId);
          // Fallback to close or error handling
          onStopAudio();
          onClose();
      }
  };

  if (!hasStarted) {
      return createPortal(
        <div className="fixed inset-0 z-[10000] bg-black text-white flex flex-col items-center justify-center p-6 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" />
            <div className="relative z-10 flex flex-col items-center animate-fade-in">
                <button onClick={startStory} className="w-24 h-24 flex items-center justify-center bg-emerald-600 rounded-full hover:scale-110 transition-transform shadow-2xl mb-8 ring-4 ring-emerald-500/30 group">
                    <Play className="w-10 h-10 fill-current ml-1 group-hover:text-white" />
                </button>
                <h2 className="text-3xl font-bold mb-2 text-white font-serif italic">Start Experience</h2>
                <p className="text-slate-400 text-sm tracking-widest uppercase">Interactive Manhwa Mode</p>
                <button onClick={onClose} className="mt-12 text-slate-500 hover:text-white transition-colors flex items-center gap-2 text-sm">
                    <X className="w-4 h-4" /> Cancel
                </button>
            </div>
        </div>,
        document.body
      );
  }

  if (!activeSegment) return null;

  // Determine current image
  let currentImageUrl: string | undefined = undefined;
  if (activeSegment.generatedImageUrls && activeSegment.generatedImageUrls[beatIndex]) {
      currentImageUrl = activeSegment.generatedImageUrls[beatIndex];
  } else if (activeSegment.masterGridImageUrl) {
      currentImageUrl = activeSegment.masterGridImageUrl; // Fallback to full grid if crop missing
  }

  // Determine current caption
  let currentCaption = "";
  if (activeSegment.panels && activeSegment.panels[beatIndex]) {
      currentCaption = activeSegment.panels[beatIndex].caption;
  } else if (beatIndex === 0) {
      currentCaption = activeSegment.text;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black text-white flex flex-col overflow-hidden font-sans">
      <audio ref={audioRef} className="hidden" />

      {/* Main Visual Layer */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
         <div className="relative w-full h-full max-w-lg mx-auto flex items-center justify-center bg-zinc-900 overflow-hidden shadow-2xl">
            {currentImageUrl ? (
                <img 
                  key={`${activeSegment.id}-${beatIndex}`} 
                  src={currentImageUrl} 
                  className={`w-full h-full object-cover ${isWaitingForChoice ? 'blur-sm scale-105' : 'animate-ken-burns'}`}
                  style={{ transition: 'filter 0.5s ease' }}
                  alt="Manhwa Panel" 
                />
            ) : (
                <div className="text-center p-10 opacity-50 flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-slate-700 border-t-slate-500 rounded-full animate-spin mb-4" />
                    <p className="mb-4 font-mono text-sm">Generating Scene Visuals...</p>
                </div>
            )}
            
            {/* Cinematic Vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
         </div>
      </div>

      {/* Choice Overlay */}
      {isWaitingForChoice && (
          <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
               <div className="max-w-md w-full space-y-4">
                   <h3 className="text-center text-2xl font-bold text-white mb-8 font-serif drop-shadow-lg flex items-center justify-center gap-3">
                        <GitBranch className="w-6 h-6 text-emerald-400" />
                        Make Your Choice
                   </h3>
                   {activeSegment.choices?.map((choice, idx) => (
                       <button
                          key={idx}
                          onClick={() => handleChoiceClick(choice.targetSegmentId)}
                          className="w-full bg-slate-900/90 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-400 text-white p-6 rounded-xl transition-all transform hover:scale-105 shadow-2xl flex items-center justify-between group"
                       >
                           <span className="font-bold text-lg">{choice.text}</span>
                           <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                       </button>
                   ))}
               </div>
          </div>
      )}

      {/* Controls / Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-[90] flex justify-between items-center pointer-events-none">
          <div className="flex gap-2">
             {/* Progress dots for beats */}
             {[0,1,2,3].map(i => (
                 <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === beatIndex ? 'w-8 bg-emerald-500' : 'w-2 bg-white/20'}`} />
             ))}
          </div>
          <button onClick={() => { onStopAudio(); onClose(); }} className="pointer-events-auto p-3 bg-black/20 hover:bg-red-600/80 rounded-full transition-colors border border-white/10 backdrop-blur-md">
              <X className="w-5 h-5" />
          </button>
      </div>

      {/* Caption Area */}
      {!isWaitingForChoice && (
          <div className="absolute bottom-12 left-0 right-0 px-6 z-[70] flex justify-center pointer-events-none">
              <div className={`max-w-xl text-center transition-all duration-500 transform ${currentCaption ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  {currentCaption && (
                      <div className="bg-slate-950/80 backdrop-blur-md px-8 py-6 rounded-2xl border border-white/10 shadow-2xl">
                        <p className="text-lg md:text-xl font-serif text-slate-100 leading-relaxed drop-shadow-md">
                            "{currentCaption}"
                        </p>
                      </div>
                  )}
              </div>
          </div>
      )}
      
      {/* Global Progress Line (Optional, maybe just beat indicators is enough for Manhwa style) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
        {/* Can add total progress here if needed */}
      </div>
    </div>,
    document.body
  );
};

export default SlideshowPlayer;
