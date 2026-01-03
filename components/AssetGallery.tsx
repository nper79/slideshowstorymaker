
import React from 'react';
import { Users, Map, RefreshCw, Wand2 } from 'lucide-react';
import { Character, Setting } from '../types';

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
          <h2 className="text-xl font-bold text-white">Character Sheets</h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-700 text-xs text-slate-300">{characters.length}</span>
        </div>
        
        {/* Changed grid to 2 columns for wider character sheets */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {characters.map(char => (
            <div key={char.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group hover:border-pink-500/50 transition-all flex flex-col md:flex-row">
              {/* Image Section */}
              <div className="md:w-2/3 aspect-video bg-slate-900 relative border-r border-slate-700">
                {char.imageUrl ? (
                  <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-6 text-center">
                    <Users className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">Character Sheet Pending</p>
                  </div>
                )}
                
                {char.isGenerating && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              
              {/* Info Section */}
              <div className="md:w-1/3 p-4 flex flex-col justify-between bg-slate-850">
                <div className="space-y-3">
                  <div className="border-b border-slate-700 pb-2">
                      <h3 className="font-bold text-white text-lg uppercase tracking-wide">{char.name}</h3>
                      <p className="text-[10px] text-slate-400 uppercase">FRONT | SIDE | BACK | FACE</p>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-6 leading-relaxed">{char.description}</p>
                </div>

                <button
                  onClick={() => onGenerateCharacter(char.id)}
                  disabled={char.isGenerating}
                  className="w-full mt-4 py-2 bg-slate-700 hover:bg-pink-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {char.imageUrl ? <RefreshCw className="w-3 h-3" /> : <Wand2 className="w-3 h-3" />}
                  {char.imageUrl ? 'Regenerate Sheet' : 'Generate Sheet'}
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
          <h2 className="text-xl font-bold text-white">Settings & Locations</h2>
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
                    <p className="text-sm">Environment Art Pending</p>
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
                  {setting.imageUrl ? 'Regenerate' : 'Generate'}
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
