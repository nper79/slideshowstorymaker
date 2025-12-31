import React, { useState, useRef } from 'react';
import { Clapperboard, Play, Wand2, Volume2, VolumeX, Clock, Zap, BrainCircuit, Grid3X3, Crop, FileText, Camera, Loader2, Download, Trash2, AlertCircle, Film, GitBranch, ArrowDownRight, CornerRightDown, RefreshCw } from 'lucide-react';
import { StorySegment, Character, Setting, AspectRatio, ImageSize, VideoClipPrompt, SegmentType } from '../types';
import SlideshowPlayer from './SlideshowPlayer';
import * as GeminiService from '../services/geminiService';
// @ts-ignore
import html2canvas from 'html2canvas';

interface StoryboardProps {
  segments: StorySegment[];
  characters: Character[];
  settings: Setting[];
  onGenerateScene: (segmentId: string, options: { aspectRatio: AspectRatio, imageSize: ImageSize }) => void;
  onEditImage: (segmentId: string, instruction: string) => void;
  onPlayAudio: (segmentId: string, text: string) => Promise<void>;
  onStopAudio: () => void;
  onSelectOption: (segmentId: string, optionIndex: number) => void;
  onDeleteAudio: (segmentId: string) => void;
}

const Storyboard: React.FC<StoryboardProps> = ({ 
  segments, 
  onGenerateScene,
  onPlayAudio,
  onStopAudio,
  onSelectOption,
  onDeleteAudio
}) => {
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);

  const storyboardContentRef = useRef<HTMLDivElement>(null);
  const [aspectRatio] = useState<AspectRatio>(AspectRatio.MOBILE); // 9:16
  const [imageSize] = useState<ImageSize>(ImageSize.K1);

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

  const GridOverlay = ({ segment }: { segment: StorySegment }) => {
     if (!segment.masterGridImageUrl) return null;
     return (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 z-10">
           {Array.from({ length: 9 }).map((_, index) => {
              const selectionOrder = segment.selectedGridIndices?.indexOf(index);
              const isSelected = selectionOrder !== -1;
              return (
              <button key={index} onClick={(e) => { e.stopPropagation(); onSelectOption(segment.id, index); }}
                className={`border-transparent hover:border-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer relative ${isSelected ? 'border-4 border-indigo-500 bg-indigo-500/5' : 'border'}`}
              >
                  {isSelected && <div className="absolute top-1 right-1 bg-indigo-500 text-black rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] shadow-lg">{selectionOrder + 1}</div>}
              </button>
           )})}
        </div>
     );
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Storyboard 9:16 (3x3 Grid)</h2>
        </div>
        <div className="flex gap-4 items-center">
             <button onClick={handleScreenshot} disabled={isTakingScreenshot} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium transition-all shadow border border-slate-600">
               {isTakingScreenshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
               Snapshot
             </button>
             <button onClick={() => setShowPlayer(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 font-bold transition-all shadow-lg">
               <Play className="w-4 h-4 fill-current" /> Play Story
             </button>
        </div>
      </div>

      <div ref={storyboardContentRef} className="space-y-6 pb-20 p-4">
        {segments.map((segment, index) => {
          const isBranch = segment.type === SegmentType.BRANCH;
          return (
          <div key={segment.id} className={`relative transition-all duration-500 ${isBranch ? 'ml-12 border-l-2 border-indigo-500/30 pl-8 pb-8' : ''}`}>
            {isBranch && <CornerRightDown className="absolute -left-6 top-0 w-6 h-6 text-indigo-500/50" />}
            <div className={`bg-slate-800/30 p-6 rounded-2xl border ${isBranch ? 'border-indigo-500/20' : 'border-slate-700/50'} backdrop-blur-sm`}>
                <div className="flex flex-col md:flex-row gap-6 mb-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${isBranch ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                {isBranch ? 'Path' : `Node ${index + 1}`}
                            </span>
                             <div className="flex items-center gap-2 ml-auto">
                                <button onClick={() => handleAudioClick(segment.id, segment.text)} disabled={generatingAudioId === segment.id}
                                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${segment.audioUrl ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 font-bold' : 'bg-indigo-600 text-white'}`}>
                                  {generatingAudioId === segment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                                  {segment.audioUrl ? 'Audio Ready' : 'Gen Audio'}
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
                         <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Grid3X3 className="w-3 h-3" /> 3x3 Variation Grid
                         </span>
                         {segment.masterGridImageUrl && (
                            <button 
                               onClick={() => onGenerateScene(segment.id, { aspectRatio, imageSize })}
                               disabled={segment.isGenerating}
                               className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2 py-1 bg-indigo-500/10 rounded border border-indigo-500/20"
                            >
                               {segment.isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                               Regenerate 3x3
                            </button>
                         )}
                      </div>

                      {!segment.masterGridImageUrl ? (
                         <div className="w-full aspect-[9/16] bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center max-w-[400px] mx-auto">
                            <button onClick={() => onGenerateScene(segment.id, { aspectRatio, imageSize })} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg">
                               <Grid3X3 className="w-4 h-4" /> {segment.isGenerating ? 'Rendering...' : 'Generate 3x3 Grid'}
                            </button>
                         </div>
                      ) : (
                         <div className="relative aspect-[9/16] rounded-lg overflow-hidden border border-slate-600 shadow-2xl bg-black max-w-[400px] mx-auto">
                            <img src={segment.masterGridImageUrl} className="w-full h-full block object-cover" />
                            <GridOverlay segment={segment} />
                         </div>
                      )}
                   </div>

                   {segment.generatedImageUrls.length > 0 && (
                      <div className="w-full md:w-1/3 space-y-4">
                         <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                             <span className="text-xs font-bold text-slate-500 uppercase">Selected Frames</span>
                         </div>
                         <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                            {segment.generatedImageUrls.map((url, idx) => (
                                 <div key={idx} className="aspect-[9/16] overflow-hidden rounded-lg border border-indigo-500/30 shadow-xl bg-slate-900 group relative">
                                     <img src={url} className="w-full h-full object-cover" />
                                 </div>
                            ))}
                         </div>
                      </div>
                   )}
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