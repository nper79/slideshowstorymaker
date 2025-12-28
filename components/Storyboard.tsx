import React, { useState } from 'react';
import { Clapperboard, Play, Image as ImageIcon, Wand2, Edit, Save, Volume2, Clock, Zap, BrainCircuit, Check, Grid3X3, Crop, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { StorySegment, Character, Setting, AspectRatio, ImageSize } from '../types';
import SlideshowPlayer from './SlideshowPlayer';

interface StoryboardProps {
  segments: StorySegment[];
  characters: Character[];
  settings: Setting[];
  onGenerateScene: (segmentId: string, options: { aspectRatio: AspectRatio, imageSize: ImageSize }) => void;
  onEditImage: (segmentId: string, instruction: string) => void;
  onPlayAudio: (text: string) => Promise<void>;
  onStopAudio: () => void;
  onSelectOption: (segmentId: string, optionIndex: number) => void; // Keeps the signature, but we handle cropping
}

const Storyboard: React.FC<StoryboardProps> = ({ 
  segments, 
  characters, 
  settings, 
  onGenerateScene,
  onEditImage,
  onPlayAudio,
  onStopAudio,
  onSelectOption
}) => {
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showPromptsForId, setShowPromptsForId] = useState<string | null>(null);
  
  // Default to MOBILE (9:16) for vertical story slideshows
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.MOBILE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K1);

  const handleAudioClick = async (id: string, text: string) => {
    setGeneratingAudioId(id);
    try {
        await onPlayAudio(text);
    } finally {
        setGeneratingAudioId(null);
    }
  }

  const togglePrompts = (id: string) => {
    if (showPromptsForId === id) {
        setShowPromptsForId(null);
    } else {
        setShowPromptsForId(id);
    }
  }

  // Helper to render the 3x3 Grid Overlay
  const GridOverlay = ({ segment }: { segment: StorySegment }) => {
     if (!segment.masterGridImageUrl) return null;

     // 9 Cells
     const cells = Array.from({ length: 9 }, (_, i) => i);

     return (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 z-10 group-hover:opacity-100 transition-opacity">
           {cells.map((index) => (
              <button
                key={index}
                onClick={(e) => {
                   e.stopPropagation();
                   onSelectOption(segment.id, index);
                }}
                className={`
                  border-white/10 hover:border-green-400 hover:bg-green-500/20 
                  transition-all duration-200 cursor-pointer relative
                  ${segment.selectedGridIndex === index ? 'border-4 border-green-500 bg-green-500/10' : 'border'}
                `}
                title={`Select Variation ${index + 1}`}
              >
                  {segment.selectedGridIndex === index && (
                      <div className="absolute top-1 right-1 bg-green-500 text-black rounded-full p-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                  )}
              </button>
           ))}
        </div>
     );
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Clapperboard className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Storyboard Grid</h2>
        </div>
        <div className="flex gap-4 items-center">
             <button
               onClick={() => setShowPlayer(true)}
               className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 font-bold transition-all shadow-lg hover:shadow-emerald-500/20 mr-4"
             >
               <Play className="w-4 h-4 fill-current" />
               Play Story
             </button>

             <select 
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value as ImageSize)}
                className="bg-slate-800 text-xs text-white border border-slate-600 rounded px-2 py-1"
             >
                {Object.values(ImageSize).map(size => <option key={size} value={size}>{size}</option>)}
             </select>
             <select 
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="bg-slate-800 text-xs text-white border border-slate-600 rounded px-2 py-1"
             >
                {Object.values(AspectRatio).map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
             </select>
        </div>
      </div>

      <div className="space-y-12 pb-20">
        {segments.map((segment, index) => (
          <div key={segment.id} className="relative bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50">
            
            {/* Header: Scene Info & Text */}
            <div className="flex flex-col md:flex-row gap-6 mb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded">Scene {index + 1}</span>
                         <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{segment.quadrant}</span>
                         <button 
                           onClick={() => handleAudioClick(segment.id, segment.text)}
                           disabled={generatingAudioId === segment.id}
                           className="text-slate-400 hover:text-white transition-colors ml-auto md:ml-2"
                         >
                           {generatingAudioId === segment.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Volume2 className="w-4 h-4" />}
                         </button>
                    </div>
                    <p className="text-slate-200 text-lg leading-relaxed font-serif">"{segment.text}"</p>
                </div>
                
                {/* Meta Tags */}
                <div className="flex flex-wrap gap-2 md:w-1/3 md:justify-end content-start">
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 text-slate-400 border border-slate-700 text-xs font-medium">
                        <Clock className="w-3 h-3" /> {segment.timeOfDay || 'Unknown'}
                     </span>
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 text-slate-400 border border-slate-700 text-xs font-medium">
                        <Zap className="w-3 h-3" /> {segment.keyVisualAction || 'Action'}
                     </span>
                     <div className="w-full text-xs text-slate-500 italic mt-2 text-right">
                        {segment.scenePrompt.substring(0, 100)}...
                     </div>
                </div>
            </div>

            {/* THE MASTER GRID OR SELECTED RESULT */}
            <div className="flex flex-col md:flex-row gap-6">
               
               {/* LEFT: The Master Grid (Contact Sheet) */}
               <div className="flex-1">
                  {!segment.masterGridImageUrl ? (
                     // Empty State / Generate Button
                     <div className="w-full h-96 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center">
                        {segment.isGenerating ? (
                           <div className="text-center py-8">
                              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                              <p className="text-indigo-400 animate-pulse font-medium">Rendering 9 Variations (3x3 Grid)...</p>
                              <p className="text-xs text-slate-500 mt-2">Constructing 9 separate perspectives...</p>
                           </div>
                        ) : (
                           <button 
                             onClick={() => onGenerateScene(segment.id, { aspectRatio, imageSize })}
                             className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-600 rounded-xl hover:bg-indigo-500 shadow-lg"
                           >
                             <Grid3X3 className="w-5 h-5" />
                             Generate 3x3 Grid
                           </button>
                        )}
                     </div>
                  ) : (
                     // THE MASTER GRID DISPLAY
                     <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-sm text-slate-400 mb-1">
                           <span className="flex items-center gap-2"><Grid3X3 className="w-4 h-4" /> Source Grid (3x3)</span>
                           
                           <div className="flex items-center gap-4">
                               <button 
                                 onClick={() => togglePrompts(segment.id)}
                                 className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                               >
                                 <FileText className="w-3 h-3" /> 
                                 {showPromptsForId === segment.id ? 'Hide Prompts' : 'View Prompts'}
                               </button>
                               <button 
                                 onClick={() => onGenerateScene(segment.id, { aspectRatio, imageSize })}
                                 className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                               >
                                 <Wand2 className="w-3 h-3" /> Regenerate
                               </button>
                           </div>
                        </div>
                        
                        <div className="relative group rounded-lg overflow-hidden border border-slate-600 shadow-2xl">
                           <img 
                              src={segment.masterGridImageUrl} 
                              alt="Master Grid" 
                              className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                           />
                           {/* OVERLAY FOR SELECTING CELLS */}
                           <GridOverlay segment={segment} />
                        </div>
                        <p className="text-center text-xs text-slate-500 mt-2">
                           Click any square above to crop and select it as the final scene.
                        </p>

                        {/* VISUAL PROMPT GRID (Togglable) */}
                        {showPromptsForId === segment.id && segment.gridVariations && (
                           <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700 animate-fade-in">
                               <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                   <BrainCircuit className="w-3 h-3" /> Grid Generation Logic
                               </h4>
                               <div className="grid grid-cols-3 gap-2">
                                   {segment.gridVariations.map((prompt, i) => (
                                       <div key={i} className={`
                                           p-2 rounded text-[10px] leading-tight border 
                                           ${segment.selectedGridIndex === i ? 'bg-indigo-900/30 border-indigo-500 text-indigo-200' : 'bg-slate-800 border-slate-700 text-slate-400'}
                                       `}>
                                           <strong className="block mb-1 text-slate-500">Panel {i+1}</strong>
                                           {prompt}
                                       </div>
                                   ))}
                               </div>
                           </div>
                        )}
                     </div>
                  )}
               </div>

               {/* RIGHT: The Selected Result (Preview) */}
               {segment.generatedImageUrl && (
                  <div className="w-full md:w-1/3 flex flex-col">
                     <div className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                        <Crop className="w-4 h-4" /> Selected Final Frame
                     </div>
                     <div className="relative rounded-lg overflow-hidden border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                        <img 
                           src={segment.generatedImageUrl} 
                           alt="Selected Crop" 
                           className="w-full h-auto object-cover"
                        />
                        <div className="absolute top-2 right-2 bg-green-500 text-black text-xs font-bold px-2 py-0.5 rounded shadow">
                           ACTIVE
                        </div>
                     </div>
                  </div>
               )}
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