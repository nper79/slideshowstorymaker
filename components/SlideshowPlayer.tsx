
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Maximize2, GitBranch, Volume2 } from 'lucide-react';
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
  onStopAudio
}) => {
  const [currentSegmentId, setCurrentSegmentId] = useState<string>(segments[0]?.id || "");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const currentSegment = segments.find(s => s.id === currentSegmentId) || segments[0];

  // Get all images for the current segment (generated beats or master grid)
  const availableImages = currentSegment.generatedImageUrls && currentSegment.generatedImageUrls.length > 0 
    ? currentSegment.generatedImageUrls 
    : (currentSegment.masterGridImageUrl ? [currentSegment.masterGridImageUrl] : []);

  const activeImage = availableImages[currentImageIndex] || availableImages[0];

  const startStory = () => {
      setHasStarted(true);
  };

  useEffect(() => {
      if (!hasStarted) return;
      const audio = audioRef.current;
      if (!audio) return;
      
      // Reset state for new segment
      setShowChoices(false);
      setCurrentImageIndex(0);
      
      // Cleanup previous timers/listeners
      if (imageIntervalRef.current) clearInterval(imageIntervalRef.current);
      if (segmentTimeoutRef.current) clearTimeout(segmentTimeoutRef.current);

      const handleTimeUpdate = () => {
          // Sync image index to audio progress
          if (availableImages.length > 1 && audio.duration && !isNaN(audio.duration)) {
              const progress = audio.currentTime / audio.duration;
              // Map progress (0.0 to 1.0) to image index (0 to length-1)
              const newIndex = Math.min(
                  Math.floor(progress * availableImages.length),
                  availableImages.length - 1
              );
              setCurrentImageIndex(prev => (prev !== newIndex ? newIndex : prev));
          }
      };

      const playMedia = async () => {
        // 1. Audio Setup
        if (currentSegment?.audioUrl) {
            audio.src = currentSegment.audioUrl;
            audio.addEventListener('timeupdate', handleTimeUpdate);
            try {
                await audio.play();
            } catch (err) {
                if ((err as any).name !== 'AbortError') console.warn("Audio error", err);
            }
        } else {
            // 2. No Audio - Manual Timer Logic
            // Default 4 seconds per segment, or 3 seconds per image if multiple
            const duration = Math.max(4000, availableImages.length * 3000);
            
            if (availableImages.length > 1) {
                const intervalTime = duration / availableImages.length;
                imageIntervalRef.current = setInterval(() => {
                    setCurrentImageIndex(prev => (prev + 1) % availableImages.length);
                }, intervalTime);
            }
            
            // Auto-advance after duration
            segmentTimeoutRef.current = setTimeout(() => handleSegmentEnd(), duration);
        }

        // 3. Video Setup (Overrides images if present)
        if (videoRef.current && currentSegment.videoUrl) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(e => console.warn("Video play failed", e));
        }
      };

      playMedia();

      return () => {
          if (segmentTimeoutRef.current) clearTimeout(segmentTimeoutRef.current);
          if (imageIntervalRef.current) clearInterval(imageIntervalRef.current);
          audio.pause();
          audio.removeEventListener('timeupdate', handleTimeUpdate);
      };
  }, [currentSegmentId, hasStarted]); // Intentionally omitting availableImages to prevent reset loops, currentSegmentId change is the trigger

  const handleChoice = (targetId: string) => {
      setCurrentSegmentId(targetId);
      setShowChoices(false);
  };

  const handleSegmentEnd = () => {
      if (currentSegment.choices && currentSegment.choices.length > 0) {
          setShowChoices(true);
      } else {
          const idx = segments.findIndex(s => s.id === currentSegmentId);
          if (idx < segments.length - 1) {
              setCurrentSegmentId(segments[idx+1].id);
          } else { 
              onStopAudio(); 
              onClose(); 
          }
      }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black text-white flex flex-col overflow-hidden">
      <audio ref={audioRef} onEnded={handleSegmentEnd} className="hidden" />

      {/* Background Layer (Video or Image) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {currentSegment.videoUrl ? (
             <video ref={videoRef} src={currentSegment.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
        ) : (
             <div className="relative w-full h-full">
                {activeImage && (
                    <img 
                      key={`${currentSegmentId}-${currentImageIndex}`} 
                      src={activeImage} 
                      className="w-full h-full object-contain md:object-cover animate-ken-burns bg-black" 
                      alt="Scene" 
                    />
                )}
                <div className="absolute inset-0 bg-black/40" />
             </div>
        )}
      </div>

      {!hasStarted && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl p-6">
              <button onClick={startStory} className="w-24 h-24 flex items-center justify-center bg-emerald-600 rounded-full hover:scale-110 transition-transform shadow-2xl mb-8 ring-4 ring-emerald-500/30">
                  <Play className="w-10 h-10 fill-current ml-1" />
              </button>
              <h2 className="text-2xl font-bold mb-2">Ready to Play</h2>
              <p className="text-slate-400 text-sm">Sit back and watch your storyboard come to life.</p>
          </div>
      )}

      {hasStarted && showChoices && currentSegment.choices && (
          <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm p-6 animate-fade-in">
              <div className="bg-slate-900/80 p-6 rounded-3xl border border-white/20 shadow-2xl w-full max-w-sm">
                  <h3 className="text-xs font-bold text-center mb-6 text-indigo-300 uppercase tracking-widest">Story Branch:</h3>
                  <div className="grid gap-3">
                      {currentSegment.choices.map((choice, i) => (
                          <button key={i} onClick={() => handleChoice(choice.targetSegmentId)} className="flex items-center justify-between p-4 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-white rounded-xl font-bold text-xs transition-all">
                              <span>{choice.text}</span>
                              <GitBranch className="w-4 h-4 opacity-40" />
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      <div className="absolute top-0 left-0 right-0 p-4 z-[90] flex justify-between items-center pointer-events-none">
          <button onClick={() => { onStopAudio(); onClose(); }} className="pointer-events-auto p-2 bg-black/30 hover:bg-red-600/60 rounded-full transition-colors border border-white/10">
              <X className="w-5 h-5" />
          </button>
      </div>

      {hasStarted && !showChoices && (
          <div className="absolute bottom-12 left-0 right-0 px-6 z-[70] flex justify-center pointer-events-none">
              <div className="max-w-xl text-center bg-black/50 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-2xl">
                  <p className="text-sm md:text-lg font-serif italic text-white/90 leading-snug">"{currentSegment.text}"</p>
                  {availableImages.length > 1 && (
                      <div className="flex justify-center gap-1 mt-4">
                          {availableImages.map((_, i) => (
                              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentImageIndex ? 'w-8 bg-emerald-500' : 'w-2 bg-white/20'}`} />
                          ))}
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>,
    document.body
  );
};

export default SlideshowPlayer;
