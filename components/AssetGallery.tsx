
import React from 'react';
import { Users, Map, RefreshCw, Wand2 } from 'lucide-react';
import { Character, Setting, AspectRatio } from '../types';

interface AssetGalleryProps {
  characters: Character[];
  settings: Setting[];
  onGenerateCharacter: (id: string) => void;
  onGenerateSetting: (id: string) => void;
}

const AssetGallery: React.FC<AssetGalleryProps> = ({ 
  characters, 
  settings, 
  onGenerateCharacter, 
  onGenerateSetting 
}) => {
  return (
    <div className="space-y-12">
      {/* Characters Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-pink-400" />
          <h2 className="text-xl font-bold text-white">Characters</h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-700 text-xs text-slate-300">{characters.length}</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {characters.map(char => (
            <div key={char.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group hover:border-pink-500/50 transition-all">
              {/* Changed from aspect-square to aspect-[4/3] to fit the side-by-side prompt output */}
              <div className="aspect-[4/3] bg-slate-900 relative">
                {char.imageUrl ? (
                  <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-6 text-center">
                    <Users className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">No image generated yet</p>
                  </div>
                )}
                
                {char.isGenerating && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="font-bold text-white mb-1">{char.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 mb-4 h-8">{char.description}</p>
                <button
                  onClick={() => onGenerateCharacter(char.id)}
                  disabled={char.isGenerating}
                  className="w-full py-2 bg-slate-700 hover:bg-pink-600 text-white text-sm rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {char.imageUrl ? <RefreshCw className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                  {char.imageUrl ? 'Regenerate' : 'Generate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Settings Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Map className="w-6 h-6 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Settings & Maps</h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-700 text-xs text-slate-300">{settings.length}</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settings.map(setting => (
            <div key={setting.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group hover:border-emerald-500/50 transition-all">
              <div className="aspect-video bg-slate-900 relative">
                 {setting.imageUrl ? (
                  <img src={setting.imageUrl} alt={setting.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-6 text-center">
                    <Map className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">Top-down map view pending</p>
                  </div>
                )}
                
                {setting.isGenerating && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="font-bold text-white mb-1">{setting.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 mb-4 h-8">{setting.description}</p>
                <button
                  onClick={() => onGenerateSetting(setting.id)}
                  disabled={setting.isGenerating}
                  className="w-full py-2 bg-slate-700 hover:bg-emerald-600 text-white text-sm rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {setting.imageUrl ? <RefreshCw className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                  {setting.imageUrl ? 'Regenerate Map' : 'Generate Map'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AssetGallery;
