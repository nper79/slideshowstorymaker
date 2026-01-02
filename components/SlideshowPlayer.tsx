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
  const [hasStarted, setHasStarted] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const currentSegment = segments.find(s => s.id === currentSegmentId) || segments[0];

  const startStory = () => {
      setHasStarted(true);
      // Playback is handled by useEffect to avoid race conditions
  };

  useEffect(() => {
      if (!hasStarted) return;
      const audio = audioRef.current;
      if (!audio) return;
      setShowChoices(false);

      let timeoutId: ReturnType<typeof setTimeout>;

      const playMedia = async () => {
        // Handle Audio
        if (currentSegment?.audioUrl) {
            audio.src = currentSegment.audioUrl;
            try {
                await audio.play();
            } catch (err) {
                // Ignore AbortError which happens when skipping quickly
                if ((err as any).name !== 'AbortError') {
                    console.warn("Audio playback interrupted:", err);
                }
            }
        } else {
            // Auto-advance if no audio
            timeoutId = setTimeout(() => handleAudioEnded(), 5000);
        }

        // Handle Video
        if (videoRef.current && currentSegment.videoUrl) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(e => console.warn("Video play failed", e));
        }
      };

      playMedia();

      return () => {
          if (timeoutId) clearTimeout(timeoutId);
          audio.pause();
      };
  }, [currentSegmentId, hasStarted]);

  const handleChoice = (targetId: string) => {
      setCurrentSegmentId(targetId);
      setShowChoices(false);
  };

  const handleAudioEnded = () => {
      if (currentSegment.choices && currentSegment.choices.length > 0) {
          setShowChoices(true);
      } else {
          const idx = segments.findIndex(s => s.id === currentSegmentId);
          if (idx < segments.length - 1) handleChoice(segments[idx+1].id);
          else { onStopAudio(); onClose(); }
      }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black text-white flex flex-col overflow-hidden">
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      {/* Background Layer (Video or Image) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {currentSegment.videoUrl ? (
             <video ref={videoRef} src={currentSegment.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
        ) : (
             <div className="relative w-full h-full">
                {currentSegment.generatedImageUrls?.[0] && (
                    <img src={currentSegment.generatedImageUrls[0]} className="w-full h-full object-cover animate-ken-burns" alt="Scene" />
                )}
                <div className="absolute inset-0 bg-black/40" />
             </div>
        )}
      </div>

      {!hasStarted && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl p-6">
              <button onClick={startStory} className="w-24 h-24 flex items-center justify-center bg-indigo-600 rounded-full hover:scale-110 transition-transform shadow-2xl mb-8">
                  <Play className="w-10 h-10 fill-current ml-1" />
              </button>
              <h2 className="text-2xl font-bold mb-2">Cinematic Preview</h2>
              <p className="text-slate-400 text-sm">Visuals and narration ready for playback.</p>
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
              </div>
          </div>
      )}
    </div>,
    document.body
  );
};

export default SlideshowPlayer;