
import React, { useState, useRef } from 'react';
import { Clapperboard, Play, Volume2, Grid3X3, Camera, Loader2, Trash2, Film, Sparkles, Check, MonitorPlay } from 'lucide-react';
import { StorySegment, AspectRatio, ImageSize, SegmentType } from '../types';
import SlideshowPlayer from './SlideshowPlayer';
// @ts-ignore
import html2canvas from 'html2canvas';

interface StoryboardProps {
  segments: StorySegment[];
  onGenerateScene: (segmentId: string, options: { aspectRatio: AspectRatio, imageSize: ImageSize }) => void;
  onGenerateVideoPrompts: (segmentId: string) => void;
  onGenerateVideo: (segmentId: string, imageIndex: number) => void;
  onPlayAudio: (segmentId: string, text: string) => Promise<void>;
  onStopAudio: () => void;
  onSelectOption: (segmentId: string, optionIndex: number) => void;
  onDeleteAudio: (segmentId: string) => void;
}

const Storyboard: React.FC<StoryboardProps> = ({ 
  segments, 
  onGenerateScene,
  onGenerateVideoPrompts,
  onGenerateVideo,
  onPlayAudio,
  onStopAudio,
  onSelectOption,
  onDeleteAudio
}) => {
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);

  const storyboardContentRef = useRef<HTMLDivElement>(null);

  const handleAudioClick = async (id: string, text: string) => {
    setGeneratingAudioId(id);
    try { await onPlayAudio(id, text); } finally { setGeneratingAudioId(null); }
  }

  const handleScreenshot = async () => {
    if (!storyboardContentRef.current) return;
    setIsTakingScreenshot(true);
    try {
      const canvas = await html2canvas(storyboardContentRef.current, { useCORS: true, backgroundColor: '#0f172a', scale: 2 });
      const link = document.createElement('a');
      link.href = canvas.toDataURL("image/png");
      link.download = `storyboard-${new Date().getTime()}.png`;
      link.click();
    } finally { setIsTakingScreenshot(false); }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Clapperboard className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Project Storyboard</h2>
        </div>
        <div className="flex gap-4 items-center">
             <button onClick={handleScreenshot} disabled={isTakingScreenshot} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all border border-slate-600">
               {isTakingScreenshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
               Snapshot
             </button>
             <button onClick={() => setShowPlayer(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 font-bold transition-all shadow-lg">
               <Play className="w-4 h-4 fill-current" /> Play Experience
             </button>
        </div>
      </div>

      <div ref={storyboardContentRef} className="space-y-12 pb-20 p-2">
        {segments.map((segment, index) => {
          const isBranch = segment.type === SegmentType.BRANCH;
          const hasSelectedBeats = segment.selectedGridIndices && segment.selectedGridIndices.length > 0;
          const hasGeneratedPrompts = segment.beatPrompts && Object.keys(segment.beatPrompts).length > 0;
          
          return (
          <div key={segment.id} className={`relative transition-all duration-500 ${isBranch ? 'ml-12 border-l-2 border-indigo-500/30 pl-8 pb-8' : ''}`}>
            
            {/* Header: Scene Text & Audio */}
            <div className="bg-slate-800/40 p-6 rounded-t-2xl border border-slate-700/50 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-slate-700 text-slate-300">
                                Scene {index + 1}
                            </span>
                             <div className="flex items-center gap-2 ml-auto">
                                {segment.audioDuration && (
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50">
                                        {segment.audioDuration.toFixed(1)}s
                                    </span>
                                )}
                                <button onClick={() => handleAudioClick(segment.id, segment.text)} disabled={generatingAudioId === segment.id}
                                  className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-bold ${segment.audioUrl ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' : 'bg-indigo-600 text-white'}`}>
                                  {generatingAudioId === segment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                                  {segment.audioUrl ? 'AUDIO READY' : 'GEN AUDIO'}
                                </button>
                                {segment.audioUrl && <button onClick={() => onDeleteAudio(segment.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 className="w-3 h-3" /></button>}
                             </div>
                        </div>
                        <p className="text-slate-200 text-lg leading-relaxed font-serif">"{segment.text}"</p>
                    </div>
                </div>
            </div>

            {/* Content: Grid vs Beats */}
            <div className="bg-slate-900/40 p-6 rounded-b-2xl border-x border-b border-slate-700/50 flex flex-col xl:flex-row gap-8">
               
               {/* LEFT: Master Grid */}
               <div className="flex-1 max-w-md">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                          <Grid3X3 className="w-4 h-4 text-indigo-400" /> 
                          1. Select Beats
                      </span>
                   </div>

                   {!segment.masterGridImageUrl ? (
                       <div className="aspect-[9/16] bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center">
                          <button onClick={() => onGenerateScene(segment.id, { aspectRatio: AspectRatio.MOBILE, imageSize: ImageSize.K1 })} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors">
                             <Grid3X3 className="w-4 h-4" /> {segment.isGenerating ? 'Rendering Grid...' : 'Generate 3x3 Grid'}
                          </button>
                       </div>
                   ) : (
                       <div className="relative aspect-[9/16] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                          <img src={segment.masterGridImageUrl} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                             {Array.from({ length: 9 }).map((_, i) => {
                               const isSelected = segment.selectedGridIndices?.includes(i);
                               return (
                                 <button 
                                    key={i} 
                                    onClick={() => onSelectOption(segment.id, i)} 
                                    className={`relative transition-all duration-200 border border-white/5 hover:border-white/30 hover:bg-white/10
                                      ${isSelected ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-500/20' : ''}
                                    `}
                                 >
                                    {isSelected && (
                                        <div className="absolute top-1 right-1 bg-indigo-600 rounded-full p-0.5 shadow-sm">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                 </button>
                               );
                             })}
                          </div>
                       </div>
                   )}
               </div>

               {/* RIGHT: Selected Beats & Prompts */}
               <div className="flex-[2] flex flex-col">
                    <div className="flex justify-between items-center mb-4 h-6">
                        <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                            <Film className="w-4 h-4 text-pink-400" /> 
                            2. Animate Selected Beats
                        </span>
                        
                        {hasSelectedBeats && (
                            <button 
                                onClick={() => onGenerateVideoPrompts(segment.id)}
                                disabled={segment.isGenerating}
                                className="text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white px-3 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {segment.isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                Generate Video Prompts
                            </button>
                        )}
                    </div>

                    <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-800 p-4 min-h-[400px]">
                        {!hasSelectedBeats ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                                <Grid3X3 className="w-8 h-8 opacity-20" />
                                <p className="text-sm">Select images from the grid to create beats.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {segment.selectedGridIndices.map((gridIndex, idx) => {
                                    const imgUrl = segment.generatedImageUrls[idx];
                                    const prompt = segment.beatPrompts?.[gridIndex];
                                    
                                    return (
                                        <div key={`${segment.id}-beat-${gridIndex}`} className="flex gap-4 bg-slate-800 p-3 rounded-lg border border-slate-700 items-start">
                                            {/* Thumbnail */}
                                            <div className="w-24 aspect-[9/16] bg-black rounded overflow-hidden shrink-0 border border-slate-600">
                                                {imgUrl && <img src={imgUrl} className="w-full h-full object-cover" />}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="text-xs font-bold text-indigo-300 uppercase">Beat {idx + 1}</h4>
                                                    
                                                    {prompt && (
                                                        <button 
                                                            onClick={() => onGenerateVideo(segment.id, idx)}
                                                            disabled={segment.isVideoGenerating}
                                                            className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition-colors"
                                                        >
                                                            {segment.isVideoGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MonitorPlay className="w-3 h-3" />}
                                                            Render Veo Video
                                                        </button>
                                                    )}
                                                </div>

                                                {!prompt ? (
                                                    <div className="h-20 flex items-center justify-center bg-slate-900/50 rounded text-slate-500 text-xs italic">
                                                        Click "Generate Video Prompts" to define motion.
                                                    </div>
                                                ) : (
                                                    <div className="bg-black/30 p-2 rounded border border-white/5">
                                                        <p className="text-xs text-slate-300 leading-relaxed font-mono">{prompt}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
               </div>

            </div>
          </div>
        )})}
      </div>

      {showPlayer && <SlideshowPlayer segments={segments} onClose={() => setShowPlayer(false)} onPlayAudio={onPlayAudio} onStopAudio={onStopAudio} />}
    </div>
  );
};

export default Storyboard;
