
import React, { useState, useRef } from 'react';
import { Clapperboard, Play, Volume2, Grid, Camera, Loader2, Trash2, Film, Check, RefreshCw, X, Maximize2, MoreHorizontal, Download, Eye, FileText } from 'lucide-react';
import { StorySegment, AspectRatio, ImageSize, SegmentType } from '../types';
import SlideshowPlayer from './SlideshowPlayer';
// @ts-ignore
import html2canvas from 'html2canvas';
import { createPortal } from 'react-dom';

interface StoryboardProps {
  segments: StorySegment[];
  onGenerateScene: (segmentId: string, options: { aspectRatio: AspectRatio, imageSize: ImageSize }) => void;
  onGenerateVideo: (segmentId: string, imageIndex: number) => void;
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
  const [showPlayer, setShowPlayer] = useState(false);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);

  const storyboardContentRef = useRef<HTMLDivElement>(null);

  const handleScreenshot = async () => {
    if (!storyboardContentRef.current) return;
    setIsTakingScreenshot(true);
    try {
      const canvas = await html2canvas(storyboardContentRef.current, { useCORS: true, backgroundColor: '#0f172a', scale: 2 });
      const link = document.createElement('a');
      link.href = canvas.toDataURL("image/png");
      link.download = `manga-panels-${new Date().getTime()}.png`;
      link.click();
    } finally { setIsTakingScreenshot(false); }
  };

  const editingSegment = segments.find(s => s.id === editingSegmentId);

  const handleAudioClick = async (id: string, text: string) => {
    setGeneratingAudioId(id);
    try { await onPlayAudio(id, text); } finally { setGeneratingAudioId(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur py-4 border-b border-slate-800">
        <div>
           <h2 className="text-2xl font-serif italic text-white">Manga Panels (新方式)</h2>
           <p className="text-xs text-slate-500 uppercase tracking-widest">{segments.length} / {segments.length} PANELS GENERATED</p>
        </div>
        <div className="flex gap-4 items-center">
             <button onClick={handleScreenshot} disabled={isTakingScreenshot} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all border border-slate-700">
               {isTakingScreenshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
               DOWNLOAD ALL AS ZIP
             </button>
             <button onClick={() => setShowPlayer(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-full flex items-center gap-2 font-bold text-xs transition-all shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/20">
               <Play className="w-4 h-4 fill-current" /> PLAY EXPERIENCE
             </button>
        </div>
      </div>

      <div ref={storyboardContentRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
        {segments.map((segment, index) => {
          // Determine what image to show: 1. Selected beat, 2. First generated beat, 3. Master Grid, 4. Placeholder
          let displayImage = null;
          if (segment.generatedImageUrls && segment.generatedImageUrls.length > 0) {
              displayImage = segment.generatedImageUrls[0]; // Show the selected beat or the first crop
          } else if (segment.masterGridImageUrl) {
              displayImage = segment.masterGridImageUrl;
          }

          return (
            <div key={segment.id} className="group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-all shadow-lg flex flex-col">
                
                {/* Header Number */}
                <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-white/20">
                    {index + 1}
                </div>

                {/* Image Area */}
                <div 
                    onClick={() => setEditingSegmentId(segment.id)}
                    className="relative w-full aspect-[16/9] bg-black cursor-pointer overflow-hidden group-image"
                >
                    {displayImage ? (
                        <img src={displayImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Panel" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-500 gap-2">
                            {segment.isGenerating ? (
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            ) : (
                                <>
                                    <Grid className="w-8 h-8 opacity-20" />
                                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">Click to Generate</span>
                                </>
                            )}
                        </div>
                    )}

                     {/* Hover Overlay */}
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <div className="bg-black/60 rounded-full p-2 backdrop-blur-sm border border-white/10">
                            <Maximize2 className="w-4 h-4 text-white" />
                        </div>
                     </div>
                </div>

                {/* Text Area */}
                <div className="p-4 bg-white min-h-[120px] flex flex-col justify-between">
                     <div>
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                             {segment.settingId ? `SCENE: ${segment.settingId.slice(0, 8)}...` : 'NARRATION'}
                         </h4>
                         <p className="text-xs text-slate-800 font-serif leading-relaxed line-clamp-4">
                             {segment.text}
                         </p>
                     </div>
                     {segment.audioUrl && (
                         <div className="mt-2 flex items-center gap-1">
                             <Volume2 className="w-3 h-3 text-emerald-600" />
                             <div className="h-0.5 bg-emerald-200 flex-1 rounded-full overflow-hidden">
                                 <div className="h-full bg-emerald-500 w-1/2" />
                             </div>
                         </div>
                     )}
                </div>
            </div>
          );
        })}
      </div>

      {/* Detail / Edit Modal */}
      {editingSegment && (
        createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingSegmentId(null)}>
                <div className="bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                    
                    {/* Modal Header */}
                    <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-950">
                        <div>
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Panel Editor</span>
                            <h3 className="text-xl font-bold text-white">Scene {segments.findIndex(s => s.id === editingSegmentId) + 1}</h3>
                        </div>
                        <button onClick={() => setEditingSegmentId(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* LEFT: Grid Generation */}
                        <div className="space-y-6">
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    <Grid className="w-4 h-4 text-indigo-400" /> 
                                    Master Grid Generation
                                </h4>
                                
                                <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative border border-slate-700 shadow-inner group">
                                     {editingSegment.masterGridImageUrl ? (
                                         <>
                                            <img src={editingSegment.masterGridImageUrl} className="w-full h-full object-contain" />
                                            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                                                {Array.from({ length: 4 }).map((_, i) => {
                                                    const isSelected = editingSegment.selectedGridIndices?.includes(i);
                                                    return (
                                                        <button 
                                                            key={i} 
                                                            onClick={() => onSelectOption(editingSegment.id, i)} 
                                                            className={`relative transition-all duration-200 border border-white/5 hover:border-white/30 hover:bg-white/10
                                                            ${isSelected ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-500/20' : ''}`}
                                                        >
                                                            {isSelected && <div className="absolute top-2 right-2 bg-indigo-600 rounded-full p-1"><Check className="w-3 h-3 text-white" /></div>}
                                                            {/* Label for order */}
                                                            <div className="absolute bottom-2 left-2 bg-black/50 text-white/50 px-1.5 rounded text-[10px] font-mono pointer-events-none">
                                                                #{i + 1}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                         </>
                                     ) : (
                                         <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                                             <Film className="w-12 h-12 mb-4 opacity-20" />
                                             <p className="text-sm mb-4">Generate a 4-panel vertical grid to choose the best angle.</p>
                                             <button 
                                                onClick={() => onGenerateScene(editingSegment.id, { aspectRatio: AspectRatio.MOBILE, imageSize: ImageSize.K1 })}
                                                disabled={editingSegment.isGenerating}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                                             >
                                                 {editingSegment.isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                 Generate Grid
                                             </button>
                                         </div>
                                     )}
                                     
                                     {editingSegment.masterGridImageUrl && (
                                         <button 
                                            onClick={() => onGenerateScene(editingSegment.id, { aspectRatio: AspectRatio.MOBILE, imageSize: ImageSize.K1 })}
                                            className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg backdrop-blur text-xs flex items-center gap-2 border border-white/10 z-10"
                                         >
                                            <RefreshCw className={`w-3 h-3 ${editingSegment.isGenerating ? 'animate-spin' : ''}`} /> Regenerate
                                         </button>
                                     )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Context & Audio */}
                        <div className="space-y-6">
                            
                            {/* Text Card */}
                            <div className="bg-white rounded-xl p-6 text-slate-900 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Script / Dialogue</h4>
                                <p className="font-serif text-lg leading-relaxed">"{editingSegment.text}"</p>
                            </div>
                            
                            {/* Beat Breakdown / Prompts */}
                            {editingSegment.gridVariations && editingSegment.gridVariations.length > 0 && (
                                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                                     <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Visual Progression (Chronological)
                                     </h4>
                                     <div className="space-y-3">
                                        {editingSegment.gridVariations.map((variation, idx) => (
                                            <div key={idx} className="flex gap-3 items-start p-3 bg-slate-900 rounded-lg border border-slate-700">
                                                <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase shrink-0 mt-0.5 border
                                                    ${idx === 0 ? 'bg-indigo-900/50 text-indigo-200 border-indigo-700' : 
                                                      idx === 1 ? 'bg-indigo-900/50 text-indigo-200 border-indigo-700' : 
                                                      idx === 2 ? 'bg-purple-900/50 text-purple-200 border-purple-700' : 
                                                      'bg-purple-900/50 text-purple-200 border-purple-700'}`}>
                                                    {idx === 0 ? 'Panel 1 (TL)' : idx === 1 ? 'Panel 2 (TR)' : idx === 2 ? 'Panel 3 (BL)' : 'Panel 4 (BR)'}
                                                </div>
                                                <p className="text-xs text-slate-300 leading-relaxed font-medium">{variation}</p>
                                            </div>
                                        ))}
                                     </div>
                                </div>
                            )}

                            {/* Audio Controls */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                                <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    <Volume2 className="w-4 h-4 text-emerald-400" />
                                    Voiceover / Narration
                                </h4>
                                
                                <div className="flex items-center gap-4">
                                     <button 
                                        onClick={() => handleAudioClick(editingSegment.id, editingSegment.text)} 
                                        disabled={generatingAudioId === editingSegment.id}
                                        className={`flex-1 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all
                                            ${editingSegment.audioUrl 
                                                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30' 
                                                : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                                     >
                                        {generatingAudioId === editingSegment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                                        {editingSegment.audioUrl ? 'Play Audio' : 'Generate Audio'}
                                     </button>
                                     
                                     {editingSegment.audioUrl && (
                                         <button onClick={() => onDeleteAudio(editingSegment.id)} className="p-3 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors text-slate-400">
                                             <Trash2 className="w-4 h-4" />
                                         </button>
                                     )}
                                </div>
                                {editingSegment.audioDuration && (
                                    <p className="text-xs text-slate-500 mt-2 text-center font-mono">Duration: {editingSegment.audioDuration.toFixed(1)}s</p>
                                )}
                            </div>

                            {/* Preview Selected */}
                            {editingSegment.generatedImageUrls && editingSegment.generatedImageUrls.length > 0 && (
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                     <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                         <Eye className="w-4 h-4 text-pink-400" />
                                         Selected Beats for Playback
                                     </h4>
                                     <div className="grid grid-cols-4 gap-2">
                                         {editingSegment.generatedImageUrls.map((url, i) => (
                                             <div key={i} className="relative group/thumb">
                                                 <img src={url} className="rounded border border-slate-600 aspect-[9/16] object-cover w-full" />
                                                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 bg-black/40 transition-opacity">
                                                     <span className="text-[10px] font-bold text-white bg-black/50 px-1 rounded">{i+1}</span>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                </div>
                            )}

                        </div>

                    </div>
                    
                    {/* Modal Footer */}
                    <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
                        <button onClick={() => setEditingSegmentId(null)} className="px-6 py-2 bg-white text-slate-900 font-bold rounded-lg hover:bg-slate-200 transition-colors">
                            Done
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )
      )}

      {showPlayer && <SlideshowPlayer segments={segments} onClose={() => setShowPlayer(false)} onPlayAudio={onPlayAudio} onStopAudio={onStopAudio} />}
    </div>
  );
};

export default Storyboard;
