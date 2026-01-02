
import React, { useState } from 'react';
import { Play, Volume2, Film, RefreshCw, Loader2, ArrowRight, Video, Sparkles, Image as ImageIcon } from 'lucide-react';
import { StorySegment } from '../types';
import SlideshowPlayer from './SlideshowPlayer';

interface StoryboardProps {
  segments: StorySegment[];
  onGenerateKeyframes: (segmentId: string) => void;
  onGenerateVideo: (segmentId: string) => void;
  onPlayAudio: (segmentId: string, text: string) => Promise<void>;
  onStopAudio: () => void;
  onUpdateDuration: (segmentId: string, duration: number) => void;
}

const Storyboard: React.FC<StoryboardProps> = ({ 
  segments, 
  onGenerateKeyframes,
  onGenerateVideo,
  onPlayAudio,
  onStopAudio,
  onUpdateDuration
}) => {
  const [showPlayer, setShowPlayer] = useState(false);

  return (
    <div className="space-y-12 pb-24">
      <div className="flex justify-between items-center sticky top-0 z-20 bg-[#0f172a]/95 backdrop-blur py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Film className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Production Storyboard</h2>
        </div>
        <button onClick={() => setShowPlayer(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold transition-all shadow-xl">
          <Play className="w-4 h-4 fill-current" /> Play Story
        </button>
      </div>

      <div className="space-y-16">
        {segments.map((segment, index) => (
          <div key={segment.id} className="bg-slate-800/20 p-8 rounded-[2rem] border border-slate-700/50 backdrop-blur-sm relative group overflow-hidden transition-all hover:bg-slate-800/30">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500/20 group-hover:bg-indigo-500 transition-colors" />
            
            <div className="flex flex-col xl:flex-row gap-10">
              {/* Beat Info */}
              <div className="flex-1 space-y-6">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-slate-700 text-slate-300 px-4 py-1.5 rounded-full">
                    SCENE BEAT {index + 1}
                  </span>
                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-500">Pace:</span>
                    <select 
                      value={segment.audioDuration || 5} 
                      onChange={(e) => onUpdateDuration(segment.id, Number(e.target.value))}
                      className="bg-transparent text-[10px] font-bold text-indigo-400 outline-none cursor-pointer"
                    >
                      {[2,4,6,8,10].map(v => <option key={v} value={v}>{v}s</option>)}
                    </select>
                  </div>
                  <button onClick={() => onPlayAudio(segment.id, segment.text)} className="ml-auto p-2 bg-indigo-500/10 rounded-full text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-2xl text-slate-100 font-serif italic leading-relaxed">"{segment.text}"</p>
                
                <div className="grid gap-4">
                   <button 
                    onClick={() => onGenerateKeyframes(segment.id)}
                    disabled={segment.isGeneratingKeyframes}
                    className="w-full py-4 rounded-xl border border-slate-600 bg-slate-900/50 flex items-center justify-center gap-3 transition-all hover:border-indigo-500 group/btn"
                   >
                     {segment.isGeneratingKeyframes ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-indigo-400" />}
                     <span className="font-bold text-sm">{segment.combinedKeyframeUrl ? 'Regenerate Keyframes' : 'Render Keyframes (Start → End)'}</span>
                   </button>

                   <button 
                    onClick={() => onGenerateVideo(segment.id)}
                    disabled={segment.isVideoGenerating || !segment.startFrameUrl || !segment.endFrameUrl}
                    className={`w-full py-4 rounded-xl border flex items-center justify-center gap-3 transition-all ${segment.isVideoGenerating ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-900 border-slate-700 hover:border-emerald-500 text-slate-400 hover:text-emerald-400'}`}
                   >
                     {segment.isVideoGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
                     <span className="font-bold text-sm">{segment.videoUrl ? 'Re-Synthesize Motion' : 'Synthesize Movement (VEO 3.1)'}</span>
                   </button>
                </div>
              </div>

              {/* Visualization Area */}
              <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
                {/* START FRAME SLOT */}
                <div className="relative group/frame">
                  <div className="aspect-[9/16] w-40 md:w-56 rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 shadow-2xl transition-transform hover:scale-105">
                    {segment.startFrameUrl ? (
                      <img src={segment.startFrameUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                        <ImageIcon className="w-10 h-10 mb-2" />
                        <span className="text-[8px] font-black tracking-widest uppercase">Start Frame</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-black/60 text-[8px] font-black px-2 py-1 rounded backdrop-blur border border-white/10 tracking-widest uppercase">Start</div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 opacity-30">
                  <ArrowRight className="w-8 h-8 text-indigo-400" />
                  <span className="text-[8px] font-black uppercase tracking-tighter">Interpolation</span>
                </div>

                {/* END FRAME SLOT */}
                <div className="relative group/frame">
                  <div className="aspect-[9/16] w-40 md:w-56 rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 shadow-2xl transition-transform hover:scale-105">
                    {segment.endFrameUrl ? (
                      <img src={segment.endFrameUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                        <ImageIcon className="w-10 h-10 mb-2" />
                        <span className="text-[8px] font-black tracking-widest uppercase">End Frame</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-black/60 text-[8px] font-black px-2 py-1 rounded backdrop-blur border border-white/10 tracking-widest uppercase">End</div>
                  </div>
                </div>
                
                {/* PREVIEW VIDEO */}
                {segment.videoUrl && (
                  <div className="sm:ml-6 aspect-[9/16] w-44 md:w-60 rounded-3xl overflow-hidden border-4 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)] animate-fade-in relative">
                     <video src={segment.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
                     <div className="absolute top-3 right-3 bg-emerald-600 text-[8px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest">Motion OK</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showPlayer && (
        <SlideshowPlayer 
          segments={segments} 
          onClose={() => setShowPlayer(false)} 
          onPlayAudio={onPlayAudio} 
          onStopAudio={onStopAudio} 
        />
      )}
    </div>
  );
};

export default Storyboard;
