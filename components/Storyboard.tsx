import React, { useState, useRef } from 'react';
import { Clapperboard, Play, Volume2, Grid3X3, Camera, Loader2, Trash2, Film, GitBranch, CornerRightDown, RefreshCw, Video } from 'lucide-react';
import { StorySegment, Character, Setting, AspectRatio, ImageSize, SegmentType } from '../types';
import SlideshowPlayer from './SlideshowPlayer';
// @ts-ignore
import html2canvas from 'html2canvas';

interface StoryboardProps {
  segments: StorySegment[];
  onGenerateScene: (segmentId: string, options: { aspectRatio: AspectRatio, imageSize: ImageSize }) => void;
  onGenerateVideo: (segmentId: string) => void;
  onPlayAudio: (segmentId: string, text: string) => Promise<void>;
  onStopAudio: () => void;
  onSelectOption: (segmentId: string, optionIndex: number) => void;
  onDeleteAudio: (segmentId: string) => void;
}

const Storyboard: React.FC<StoryboardProps> = ({ 
  segments, 
  onGenerateScene,
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
          <GitBranch className="w-6 h-6 text-indigo-400" />
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

      <div ref={storyboardContentRef} className="space-y-6 pb-20 p-4">
        {segments.map((segment, index) => {
          const isBranch = segment.type === SegmentType.BRANCH;
          const isVideoGen = segment.isVideoGenerating;
          
          return (
          <div key={segment.id} className={`relative transition-all duration-500 ${isBranch ? 'ml-12 border-l-2 border-indigo-500/30 pl-8 pb-8' : ''}`}>
            {isBranch && <CornerRightDown className="absolute -left-6 top-0 w-6 h-6 text-indigo-500/50" />}
            <div className={`bg-slate-800/30 p-6 rounded-2xl border ${isBranch ? 'border-indigo-500/20' : 'border-slate-700/50'} backdrop-blur-sm`}>
                <div className="flex flex-col md:flex-row gap-6 mb-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${isBranch ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                {isBranch ? 'Branch' : `Scene ${index + 1}`}
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

                <div className="flex flex-col md:flex-row gap-6">
                   <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                         <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Grid3X3 className="w-3 h-3" /> Variation Grid
                         </span>
                         {segment.masterGridImageUrl && (
                            <button onClick={() => onGenerateScene(segment.id, { aspectRatio: AspectRatio.MOBILE, imageSize: ImageSize.K1 })} disabled={segment.isGenerating} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2 py-1 bg-indigo-500/10 rounded border border-indigo-500/20">
                               {segment.isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                               Regen Grid
                            </button>
                         )}
                      </div>

                      {!segment.masterGridImageUrl ? (
                         <div className="w-full aspect-[9/16] bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center max-w-[300px] mx-auto">
                            <button onClick={() => onGenerateScene(segment.id, { aspectRatio: AspectRatio.MOBILE, imageSize: ImageSize.K1 })} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">
                               <Grid3X3 className="w-4 h-4" /> {segment.isGenerating ? 'Rendering...' : 'Gen Scene Grid'}
                            </button>
                         </div>
                      ) : (
                         <div className="relative aspect-[9/16] rounded-lg overflow-hidden border border-slate-600 bg-black max-w-[300px] mx-auto">
                            <img src={segment.masterGridImageUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                               {Array.from({ length: 9 }).map((_, i) => (
                                 <button key={i} onClick={() => onSelectOption(segment.id, i)} className={`border border-white/5 hover:border-indigo-500 transition-all ${segment.selectedGridIndices?.includes(i) ? 'bg-indigo-500/20 border-indigo-500 ring-2 ring-indigo-500 inset' : ''}`} />
                               ))}
                            </div>
                         </div>
                      )}
                   </div>

                   <div className="w-full md:w-1/3 flex flex-col gap-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Cinematic Video</span>
                      
                      {!segment.videoUrl ? (
                         <button 
                            onClick={() => onGenerateVideo(segment.id)}
                            disabled={isVideoGen || !segment.generatedImageUrls?.length}
                            className={`w-full aspect-[9/16] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all p-4 text-center ${isVideoGen ? 'border-amber-500/50 bg-amber-500/5 text-amber-400' : 'border-slate-700 hover:border-amber-500/50 bg-slate-900/50'}`}
                         >
                            {isVideoGen ? (
                               <>
                                 <Loader2 className="w-8 h-8 animate-spin" />
                                 <p className="text-[10px] font-bold uppercase tracking-tighter">Synthesizing Motion...</p>
                                 <p className="text-[9px] opacity-60">This may take 1-2 minutes</p>
                               </>
                            ) : (
                               <>
                                 <Film className="w-8 h-8 opacity-20" />
                                 <p className="text-xs font-bold">Generate Video</p>
                                 <p className="text-[10px] text-slate-500">Transform static frame into 9:16 Veo Video</p>
                               </>
                            )}
                         </button>
                      ) : (
                         <div className="relative aspect-[9/16] rounded-xl overflow-hidden border border-amber-500/30 group">
                            <video src={segment.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onGenerateVideo(segment.id)} className="p-3 bg-amber-500 text-black rounded-full shadow-2xl">
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="absolute top-2 right-2 bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded shadow">VEO 3.1</div>
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