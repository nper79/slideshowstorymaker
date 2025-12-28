import React, { useState } from 'react';
import { Clapperboard, Play, Image as ImageIcon, Wand2, Edit, Save, Volume2, Clock, Zap, BrainCircuit } from 'lucide-react';
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
}

const Storyboard: React.FC<StoryboardProps> = ({ 
  segments, 
  characters, 
  settings, 
  onGenerateScene,
  onEditImage,
  onPlayAudio,
  onStopAudio
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);

  // Default to MOBILE (9:16) for vertical story slideshows
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.MOBILE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K1);

  const getCharacterNames = (ids: string[]) => {
    return ids.map(id => characters.find(c => c.id === id)?.name).filter(Boolean).join(', ');
  };

  const getSettingName = (id: string) => settings.find(s => s.id === id)?.name;

  const handleEditSubmit = (id: string) => {
    if (editPrompt.trim()) {
      onEditImage(id, editPrompt);
      setEditingId(null);
      setEditPrompt('');
    }
  };

  const handleAudioClick = async (id: string, text: string) => {
    setGeneratingAudioId(id);
    try {
        await onPlayAudio(text);
    } finally {
        setGeneratingAudioId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Clapperboard className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Storyboard Timeline</h2>
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
          <div key={segment.id} className="relative pl-8 md:pl-0">
            {/* Timeline Connector */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-800 md:left-1/2 md:-ml-px"></div>
            <div className="absolute left-0 top-6 w-4 h-4 -ml-2 rounded-full bg-slate-700 border-2 border-slate-500 md:left-1/2 md:-ml-2 z-10"></div>

            <div className={`flex flex-col md:flex-row gap-8 ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
              
              {/* Text Content */}
              <div className="flex-1 bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-start mb-4">
                   <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Scene {index + 1}</span>
                   <button 
                     onClick={() => handleAudioClick(segment.id, segment.text)}
                     disabled={generatingAudioId === segment.id}
                     className="text-slate-400 hover:text-white transition-colors"
                     title="Read Aloud"
                   >
                     {generatingAudioId === segment.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Volume2 className="w-4 h-4" />}
                   </button>
                </div>
                <p className="text-slate-200 text-lg leading-relaxed font-serif mb-6">"{segment.text}"</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-medium">
                        <Clock className="w-3 h-3" /> {segment.timeOfDay || 'Unknown Time'}
                     </span>
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-medium">
                        <Zap className="w-3 h-3" /> {segment.keyVisualAction || 'Action Scene'}
                     </span>
                </div>

                {segment.temporalLogic && (
                  <div className="mb-4 text-xs text-slate-500 flex items-start gap-2 bg-slate-900/30 p-2 rounded">
                    <BrainCircuit className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="italic">{segment.temporalLogic}</span>
                  </div>
                )}

                <div className="space-y-2 text-sm text-slate-400 bg-slate-900/50 p-4 rounded-lg">
                  <div className="flex gap-2">
                    <span className="font-semibold text-slate-500">Setting:</span>
                    <span className="text-emerald-400">{getSettingName(segment.settingId)}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-slate-500">Characters:</span>
                    <span className="text-pink-400">{getCharacterNames(segment.characterIds) || 'None'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-slate-500">Quadrant:</span>
                    <span className="text-yellow-400">{segment.quadrant}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-700/50 mt-2">
                    <span className="font-semibold text-slate-500 block mb-1">Visual Prompt:</span>
                    <p className="italic text-slate-300 text-xs">{segment.scenePrompt}</p>
                  </div>
                </div>
              </div>

              {/* Visual Content - Adjusted aspect ratio container style */}
              <div className="flex-1 flex justify-center">
                <div 
                    className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-lg relative group transition-all"
                    style={{ 
                        // Dynamically adjust container aspect ratio based on selection
                        aspectRatio: aspectRatio.replace(':', '/'),
                        width: aspectRatio === AspectRatio.MOBILE ? '300px' : '100%' 
                    }}
                >
                  {segment.generatedImageUrl ? (
                    <>
                      <img src={segment.generatedImageUrl} alt="Scene" className="w-full h-full object-cover" />
                      
                      {/* Edit Overlay */}
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6">
                        {editingId === segment.id ? (
                           <div className="w-full max-w-sm space-y-3">
                              <input 
                                type="text" 
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                placeholder="e.g. Add a retro filter..." 
                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button onClick={() => handleEditSubmit(segment.id)} className="flex-1 bg-indigo-600 text-white py-2 rounded text-xs font-bold">Apply Edit</button>
                                <button onClick={() => setEditingId(null)} className="px-3 bg-slate-700 text-white rounded text-xs">Cancel</button>
                              </div>
                           </div>
                        ) : (
                          <div className="flex gap-3">
                             <button 
                                onClick={() => onGenerateScene(segment.id, { aspectRatio, imageSize })}
                                className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                             >
                                <Play className="w-4 h-4" /> Regenerate
                             </button>
                             <button 
                                onClick={() => setEditingId(segment.id)}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                             >
                                <Edit className="w-4 h-4" /> Edit
                             </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-8">
                      <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                      {segment.isGenerating ? (
                        <div className="text-center">
                           <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                           <p className="text-indigo-400 text-sm animate-pulse">Rendering Scene...</p>
                        </div>
                      ) : (
                        <button 
                          onClick={() => onGenerateScene(segment.id, { aspectRatio, imageSize })}
                          className="bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all border border-slate-700 hover:border-indigo-500"
                        >
                          <Wand2 className="w-5 h-5" />
                          Generate Scene
                        </button>
                      )}
                    </div>
                  )}
                </div>
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