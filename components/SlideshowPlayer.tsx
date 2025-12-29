import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, SkipForward } from 'lucide-react';
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
  const [animationClass, setAnimationClass] = useState('animate-ken-burns');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const segment = segments[currentSegmentIndex];
  const images = segment.generatedImageUrls && segment.generatedImageUrls.length > 0 
    ? segment.generatedImageUrls 
    : [];

  // Toggle animation direction for variety on slide change
  useEffect(() => {
    // Randomize between zoom in and zoom out (reverse)
    const variant = Math.random() > 0.5 ? 'animate-ken-burns' : 'animate-ken-burns-reverse';
    setAnimationClass(variant);
  }, [currentSegmentIndex, currentImageIndex]);

  // 1. Initialize Audio on Segment Change
  useEffect(() => {
      // Stop previous
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
      }
      setCurrentImageIndex(0);

      // Setup new audio if available
      if (segment.audioUrl) {
          const audio = new Audio(segment.audioUrl);
          audioRef.current = audio;
          
          audio.onended = handleAudioEnded;
          
          if (isPlaying) {
              audio.play().catch(e => console.error("Auto-play failed", e));
          }
      } else {
          // No audio? Just wait a default 5s then move on if playing
          if (isPlaying) {
             const timer = setTimeout(handleAudioEnded, 5000);
             return () => clearTimeout(timer);
          }
      }
  }, [currentSegmentIndex]);

  // 2. Handle Image Cycling (Visual Pacing)
  useEffect(() => {
     if (!isPlaying || images.length <= 1 || !segment.audioUrl) return;

     // Calculate time per slide
     // Add a small "breathing room" to total duration (e.g. +1s) so the last image lingers slightly
     const duration = (segment.audioDuration || 10) + 1.0; 
     const timePerSlide = (duration * 1000) / images.length;

     const interval = setInterval(() => {
         setCurrentImageIndex(prev => {
             const next = prev + 1;
             return next >= images.length ? prev : next;
         });
     }, timePerSlide);

     return () => clearInterval(interval);

  }, [currentSegmentIndex, isPlaying, images.length, segment.audioUrl, segment.audioDuration]);

  // 3. Handle Play/Pause Toggles
  useEffect(() => {
      if (audioRef.current) {
          if (isPlaying) {
              audioRef.current.play().catch(console.error);
          } else {
              audioRef.current.pause();
          }
      }
  }, [isPlaying]);

  const handleAudioEnded = () => {
      // Audio finished. Move to next segment.
      if (currentSegmentIndex < segments.length - 1) {
          setCurrentSegmentIndex(prev => prev + 1);
          setCurrentImageIndex(0);
      } else {
          setIsPlaying(false);
      }
  };

  const nextSlide = () => {
    if (currentSegmentIndex < segments.length - 1) {
      setCurrentSegmentIndex(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSegmentIndex > 0) {
      setCurrentSegmentIndex(prev => prev - 1);
    }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const stopPlayback = () => {
    setIsPlaying(false);
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    onStopAudio(); // Stop any global audio service context
  };

  const currentImage = images.length > 0 ? images[currentImageIndex] : undefined;

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col animate-fade-in">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium opacity-70">
            Scene {currentSegmentIndex + 1} / {segments.length}
          </span>
          {images.length > 1 && (
               <span className="text-xs bg-white/10 px-2 py-1 rounded">
                   Frame {currentImageIndex + 1} / {images.length}
               </span>
          )}
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
        {currentImage && (
          <div 
            className="absolute inset-0 z-0 opacity-20 blur-3xl scale-110 transition-all duration-1000"
            style={{ 
              backgroundImage: `url(${currentImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        )}

        <div className="flex flex-col md:flex-row max-w-7xl w-full h-full md:h-auto gap-8 md:gap-12 items-center z-10">
          
          {/* Image */}
          <div className="flex-1 flex justify-center items-center w-full max-h-[70vh] md:max-h-[85vh]">
            {/* Removed hardcoded aspect ratio to let image dims dictate. Added max-h constraint. */}
            <div className="relative rounded-lg overflow-hidden shadow-2xl shadow-black/50 border border-white/10 w-auto h-auto max-w-full max-h-full">
               {currentImage ? (
                 <img 
                   key={`${currentSegmentIndex}-${currentImageIndex}`} // Force remount to restart CSS animation
                   src={currentImage} 
                   alt={`Scene ${currentSegmentIndex + 1}`} 
                   className={`w-full h-full object-cover bg-black ${animationClass}`}
                   style={{ minHeight: '300px' }} 
                 />
               ) : (
                 <div className="w-full h-full min-h-[400px] min-w-[300px] bg-slate-900 flex items-center justify-center text-slate-500 p-8 text-center">
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
               {segment.quadrant} &bull; Scene {currentSegmentIndex + 1}
            </div>
            {!segment.audioUrl && (
                <div className="text-amber-500 text-sm">
                    ⚠️ Audio not generated for this scene.
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center items-center gap-8 bg-gradient-to-t from-black/90 to-transparent z-10">
        <button 
          onClick={prevSlide}
          disabled={currentSegmentIndex === 0}
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
             onClick={handleAudioEnded}
             className="w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
             title="Skip Scene"
           >
             <SkipForward className="w-5 h-5 fill-current" />
           </button>
        )}

        <button 
          onClick={nextSlide}
          disabled={currentSegmentIndex === segments.length - 1}
          className="p-3 rounded-full hover:bg-white/10 disabled:opacity-30 transition-all"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};

export default SlideshowPlayer;