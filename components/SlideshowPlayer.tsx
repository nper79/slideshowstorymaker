import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Maximize2, GitBranch, Volume2, Loader2 } from 'lucide-react';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  const currentSegment = segments.find(s => s.id === currentSegmentId) || segments[0];
  const images = currentSegment?.generatedImageUrls || [];
  const currentImage = images[currentImageIndex];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        playerContainerRef.current?.requestFullscreen().catch(e => console.error(e));
    } else {
        document.exitFullscreen().catch(e => console.error(e));
    }
  };

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  const startStory = () => {
      setHasStarted(true);
      setIsPlaying(true);
      if (audioRef.current && currentSegment?.audioUrl) {
          audioRef.current.src = currentSegment.audioUrl;
          audioRef.current.play().catch(e => console.warn("Audio play blocked initially", e));
      }
  };

  useEffect(() => {
      if (!hasStarted) return;
      const audio = audioRef.current;
      if (!audio) return;

      setShowChoices(false); // Reset choices view on new segment

      if (currentSegment?.audioUrl) {
          audio.src = currentSegment.audioUrl;
          if (isPlaying) {
              audio.play().catch(e => console.warn("Failed to play segment audio", e));
          }
      } else {
          // If no audio, simulate end after 5s
          const timer = setTimeout(() => handleAudioEnded(), 5000);
          return () => clearTimeout(timer);
      }
  }, [currentSegmentId, currentSegment?.audioUrl, hasStarted, isPlaying]);

  useEffect(() => {
     if (!isPlaying || images.length <= 1 || !hasStarted || showChoices) return;
     const dur = currentSegment?.audioDuration || 5;
     const interval = setInterval(() => {
         setCurrentImageIndex(prev => (prev + 1) % images.length);
     }, (dur * 1000) / images.length);
     return () => clearInterval(interval);
  }, [isPlaying, images.length, currentSegment?.audioDuration, hasStarted, showChoices]);

  const handleChoice = (targetId: string) => {
      setCurrentSegmentId(targetId);
      setCurrentImageIndex(0);
      setShowChoices(false);
  };

  const handleAudioEnded = () => {
      if (currentSegment.choices && currentSegment.choices.length > 0) {
          setShowChoices(true);
      } else {
          handleNext();
      }
  };

  const handleNext = () => {
      if (currentSegment.nextSegmentId) {
          handleChoice(currentSegment.nextSegmentId);
      } else {
          const idx = segments.findIndex(s => s.id === currentSegmentId);
          if (idx < segments.length - 1) {
              handleChoice(segments[idx+1].id);
          } else {
              onStopAudio();
              onClose();
          }
      }
  };

  return createPortal(
    <div ref={playerContainerRef} className="fixed inset-0 z-[10000] bg-black text-white flex flex-col overflow-hidden">
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      {/* Visual Content Layer */}
      <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
        {currentImage ? (
             <div className="relative w-full h-full flex items-center justify-center">
                 <img key={currentImage} src={currentImage} className="max-h-full max-w-full object-contain animate-ken-burns shadow-2xl" alt="Scene" />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
             </div>
        ) : (
             <div className="text-slate-500 text-center">
                 <Volume2 className="w-12 h-12 mx-auto mb-4 opacity-10" />
                 <p className="font-medium text-sm">Playing narration...</p>
             </div>
        )}
      </div>

      {/* Start Modal */}
      {!hasStarted && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
              <div className="bg-slate-900/80 p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl text-center max-w-sm">
                  <button onClick={startStory} className="group relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center bg-emerald-600 rounded-full hover:scale-110 transition-transform shadow-2xl shadow-emerald-500/50 mx-auto mb-6 md:mb-8">
                      <Play className="w-8 h-8 md:w-10 md:h-10 fill-current ml-1 text-white" />
                      <div className="absolute inset-0 rounded-full border-4 border-emerald-400/30 animate-ping" />
                  </button>
                  <h2 className="text-xl md:text-2xl font-bold mb-2">Start Experience</h2>
                  <p className="text-slate-400 text-sm">Ready to watch the story with full narration.</p>
              </div>
          </div>
      )}

      {/* Choices Layer - Only visible after audio ends */}
      {hasStarted && showChoices && currentSegment.choices && currentSegment.choices.length > 0 && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px] p-4 transition-all duration-500">
              <div className="bg-slate-900/85 p-6 md:p-8 rounded-3xl border border-white/20 shadow-2xl w-full max-w-md animate-fade-in">
                  <h3 className="text-lg md:text-xl font-bold text-center mb-6 text-indigo-300">Choose your path:</h3>
                  <div className="grid gap-2.5">
                      {currentSegment.choices.map((choice, i) => (
                          <button key={i} onClick={() => handleChoice(choice.targetSegmentId)}
                            className="flex items-center justify-between p-3.5 md:p-5 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 text-white rounded-xl font-bold text-sm md:text-base transition-all transform hover:scale-[1.02]">
                              <span>{choice.text}</span>
                              <GitBranch className="w-4 h-4 md:w-5 md:h-5 opacity-50" />
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* HUD Header */}
      <div className="absolute top-0 left-0 right-0 p-4 md:p-6 z-50 flex justify-between items-center pointer-events-none">
          <button onClick={() => { onStopAudio(); onClose(); }} className="pointer-events-auto p-2 bg-black/40 hover:bg-red-600/60 rounded-full transition-colors border border-white/10 backdrop-blur">
              <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <div className="flex gap-2.5 md:gap-4 pointer-events-auto">
              <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 bg-black/40 rounded-full border border-white/10 backdrop-blur">
                  {isPlaying ? <Volume2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" /> : <Volume2 className="w-5 h-5 md:w-6 md:h-6 text-slate-500" />}
              </button>
              <button onClick={toggleFullscreen} className="p-2 bg-black/40 rounded-full border border-white/10 backdrop-blur">
                  <Maximize2 className="w-5 h-5 md:w-6 md:h-6" />
              </button>
          </div>
      </div>

      {/* Subtitles Layer - Hidden when choices are active */}
      {hasStarted && !showChoices && (
          <div className="absolute bottom-10 left-0 right-0 px-4 md:px-8 z-40 flex justify-center pointer-events-none">
              <div className="max-w-3xl text-center bg-black/40 backdrop-blur-md px-6 py-4 md:px-10 md:py-6 rounded-2xl border border-white/5 shadow-xl">
                  <p className="text-sm md:text-lg lg:text-xl font-serif italic text-white/95 leading-snug md:leading-relaxed">
                      {currentSegment.text}
                  </p>
              </div>
          </div>
      )}

      {/* Progress Bar */}
      {hasStarted && isPlaying && !showChoices && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-50">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300 ease-linear"
                style={{ width: `${(currentImageIndex + 1) / images.length * 100}%` }}
              />
          </div>
      )}
    </div>,
    document.body
  );
};

export default SlideshowPlayer;