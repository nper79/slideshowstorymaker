import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Square } from 'lucide-react';
import { StorySegment } from '../types';

interface SlideshowPlayerProps {
  segments: StorySegment[];
  onClose: () => void;
  onPlayAudio: (text: string) => Promise<void>;
  onStopAudio: () => void;
}

const SlideshowPlayer: React.FC<SlideshowPlayerProps> = ({
  segments,
  onClose,
  onPlayAudio,
  onStopAudio
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const segment = segments[currentIndex];
  const isPlayingRef = useRef(isPlaying);

  // Sync ref
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      onStopAudio();
    }
  }, [isPlaying]);

  // Main playback loop
  useEffect(() => {
    let isCancelled = false;

    const runSequence = async () => {
       if (isPlaying && !isCancelled) {
          try {
             await onPlayAudio(segment.text);
             
             // Check if we should still proceed
             if (!isCancelled && isPlayingRef.current) {
                if (currentIndex < segments.length - 1) {
                  setCurrentIndex(prev => prev + 1);
                } else {
                  setIsPlaying(false);
                }
             }
          } catch (e) {
             console.error("Audio playback error:", e);
             setIsPlaying(false);
          }
       }
    };

    if (isPlaying) {
      runSequence();
    }

    return () => {
       isCancelled = true;
       // We do NOT stop audio here on unmount of effect unless it was a hard stop
       // But to ensure clean transitions:
       onStopAudio();
    };
  }, [currentIndex, isPlaying]); // Reruns when index changes or play state toggles

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === ' ') togglePlay();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isPlaying]);

  const nextSlide = () => {
    if (currentIndex < segments.length - 1) {
      setIsPlaying(false);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setIsPlaying(false);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const stopPlayback = () => {
    setIsPlaying(false);
    onStopAudio();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col animate-fade-in">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium opacity-70">
            Scene {currentIndex + 1} / {segments.length}
          </span>
        </div>
        <button 
          onClick={() => { stopPlayback(); onClose(); }}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-8 relative">
        {/* Background Blur */}
        {segment.generatedImageUrl && (
          <div 
            className="absolute inset-0 z-0 opacity-20 blur-3xl scale-110"
            style={{ 
              backgroundImage: `url(${segment.generatedImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        )}

        <div className="flex flex-col md:flex-row max-w-7xl w-full h-full md:h-auto gap-8 md:gap-12 items-center z-10">
          
          {/* Image */}
          <div className="flex-1 flex justify-center items-center w-full max-h-[60vh] md:max-h-[80vh]">
            <div className="relative rounded-lg overflow-hidden shadow-2xl shadow-black/50 border border-white/10 max-w-full max-h-full aspect-[9/16]">
               {segment.generatedImageUrl ? (
                 <img 
                   src={segment.generatedImageUrl} 
                   alt={`Scene ${currentIndex + 1}`} 
                   className="w-full h-full object-contain bg-black"
                 />
               ) : (
                 <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 p-8 text-center">
                   Generating Scene...
                 </div>
               )}
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 max-w-2xl space-y-6 text-center md:text-left">
            <p className="text-xl md:text-2xl lg:text-3xl font-serif leading-relaxed drop-shadow-lg text-slate-100">
              "{segment.text}"
            </p>
            <div className="text-sm text-slate-400 font-sans tracking-wide uppercase">
               {segment.quadrant} &bull; Scene {currentIndex + 1}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center items-center gap-8 bg-gradient-to-t from-black/90 to-transparent z-10">
        <button 
          onClick={prevSlide}
          disabled={currentIndex === 0}
          className="p-3 rounded-full hover:bg-white/10 disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <button 
          onClick={togglePlay}
          className={`w-16 h-16 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)] ${isPlaying ? 'bg-slate-700 text-white' : 'bg-white text-black'}`}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-1" />
          )}
        </button>

        {isPlaying && (
           <button 
             onClick={stopPlayback}
             className="w-12 h-12 bg-red-600/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
             title="Stop Audio"
           >
             <Square className="w-5 h-5 fill-current" />
           </button>
        )}

        <button 
          onClick={nextSlide}
          disabled={currentIndex === segments.length - 1}
          className="p-3 rounded-full hover:bg-white/10 disabled:opacity-30 transition-all"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};

export default SlideshowPlayer;