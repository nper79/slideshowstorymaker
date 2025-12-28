import React, { useState, useEffect, useRef } from 'react';
import { Layout, Clapperboard, Layers, ChevronRight, Key, ExternalLink, Download, Upload } from 'lucide-react';
import StoryInput from './components/StoryInput';
import AssetGallery from './components/AssetGallery';
import Storyboard from './components/Storyboard';
import { StoryData, ProcessingStatus, AspectRatio, ImageSize } from './types';
import * as GeminiService from './services/geminiService';
import * as StorageService from './services/storageService';

enum Tab {
  INPUT = 'input',
  ASSETS = 'assets',
  STORYBOARD = 'storyboard'
}

interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INPUT);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice selection state (default to 'Puck')
  const [selectedVoice, setSelectedVoice] = useState('Puck');

  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio as AIStudio | undefined;
      if (aistudio) {
        try {
          const selected = await aistudio.hasSelectedApiKey();
          if (selected) {
            setHasApiKey(true);
          }
        } catch (e) {
          console.error("Error checking API key:", e);
        }
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio as AIStudio | undefined;
    if (aistudio) {
      try {
        await aistudio.openSelectKey();
        // Assuming success as per instructions to mitigate race condition
        setHasApiKey(true);
      } catch (e) {
        console.error("Error selecting API key:", e);
      }
    }
  };

  const handleAnalyzeStory = async (text: string, style: string) => {
    setStatus(ProcessingStatus.ANALYZING);
    try {
      const data = await GeminiService.analyzeStoryText(text, style);
      setStoryData(data);
      setStatus(ProcessingStatus.READY);
      setActiveTab(Tab.ASSETS);
    } catch (error: any) {
      console.error(error);
      setStatus(ProcessingStatus.ERROR);
      
      // If permission denied, reset key state to force re-selection
      if (error.toString().includes("403") || error.toString().includes("PERMISSION_DENIED")) {
         alert("Permission Denied. Please ensure you select a Paid API Key with access to Gemini 3 models.");
         setHasApiKey(false);
      } else {
         alert("Failed to analyze story. Error: " + error.message);
      }
    }
  };

  const handleGenerateCharacter = async (id: string) => {
    if (!storyData) return;
    
    setStoryData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: prev.characters.map(c => c.id === id ? { ...c, isGenerating: true } : c)
      };
    });

    try {
      const char = storyData.characters.find(c => c.id === id);
      if (!char) return;
      
      const prompt = `Full body character portrait. Character: ${char.name}. Description: ${char.description}. ${char.visualPrompt}.`;
      
      // Pass the global style guide to ensure character fits the world
      const imageUrl = await GeminiService.generateImage(prompt, AspectRatio.SQUARE, ImageSize.K1, [], storyData.visualStyleGuide, storyData.cinematicDNA);

      setStoryData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          characters: prev.characters.map(c => c.id === id ? { ...c, imageUrl, isGenerating: false } : c)
        };
      });
    } catch (e) {
      console.error(e);
      setStoryData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          characters: prev.characters.map(c => c.id === id ? { ...c, isGenerating: false } : c)
        };
      });
    }
  };

  const handleGenerateSetting = async (id: string) => {
    if (!storyData) return;
    
    setStoryData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        settings: prev.settings.map(s => s.id === id ? { ...s, isGenerating: true } : s)
      };
    });

    try {
      const setting = storyData.settings.find(s => s.id === id);
      if (!setting) return;
      
      const prompt = `Direct top-down overhead camera view. Setting: ${setting.name}. Description: ${setting.description}. ${setting.visualPrompt}.`;
      
      // Pass the global style guide
      const imageUrl = await GeminiService.generateImage(prompt, AspectRatio.LANDSCAPE, ImageSize.K1, [], storyData.visualStyleGuide, storyData.cinematicDNA);

      setStoryData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          settings: prev.settings.map(s => s.id === id ? { ...s, imageUrl, isGenerating: false } : s)
        };
      });
    } catch (e) {
      console.error(e);
      setStoryData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          settings: prev.settings.map(s => s.id === id ? { ...s, isGenerating: false } : s)
        };
      });
    }
  };

  const handleGenerateScene = async (segmentId: string, options: { aspectRatio: AspectRatio, imageSize: ImageSize }) => {
    if (!storyData) return;

    setStoryData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: true } : s)
      };
    });

    try {
      const segment = storyData.segments.find(s => s.id === segmentId);
      if (!segment) throw new Error("Segment not found");

      // Gather references with strict ordering for consistency
      const refImages: string[] = [];

      // 1. Character Reference (Primary Master for Clothing)
      segment.characterIds.forEach(charId => {
        const char = storyData.characters.find(c => c.id === charId);
        if (char?.imageUrl) refImages.push(char.imageUrl);
      });
      
      // 2. Setting Reference
      const setting = storyData.settings.find(s => s.id === segment.settingId);
      if (setting?.imageUrl) refImages.push(setting.imageUrl);

      // 3. Previous Scene Reference (Consistency Continuity)
      const currentIndex = storyData.segments.findIndex(s => s.id === segmentId);
      if (currentIndex > 0) {
        const prevSegment = storyData.segments[currentIndex - 1];
        if (prevSegment.generatedImageUrl) {
           refImages.push(prevSegment.generatedImageUrl);
        }
      }

      // Include temporal details in the prompt
      const prompt = `
        Time of Day: ${segment.timeOfDay} (Reasoning: ${segment.temporalLogic}). 
        Key Visual Action: ${segment.keyVisualAction}.
        Scene Details: ${segment.scenePrompt}
        Setting: ${setting?.name || 'Unknown'}, in the ${segment.quadrant}.
        Characters present: ${segment.characterIds.map(id => storyData.characters.find(c => c.id === id)?.name).join(', ')}.
      `;

      // Pass the visualStyleGuide AND cinematicDNA
      const imageUrl = await GeminiService.generateImage(prompt, options.aspectRatio, options.imageSize, refImages, storyData.visualStyleGuide, storyData.cinematicDNA);

      setStoryData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          segments: prev.segments.map(s => s.id === segmentId ? { ...s, generatedImageUrl: imageUrl, isGenerating: false } : s)
        };
      });

    } catch (e: any) {
       console.error(e);
       if (e.toString().includes("403") || e.toString().includes("PERMISSION_DENIED")) {
         alert("Permission Denied. Your session may have expired or the key lacks permission.");
         setHasApiKey(false);
       }
       setStoryData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: false } : s)
        };
      });
    }
  };

  const handleEditImage = async (segmentId: string, instruction: string) => {
    if (!storyData) return;

     setStoryData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: true } : s)
      };
    });

    try {
      const segment = storyData.segments.find(s => s.id === segmentId);
      if (!segment || !segment.generatedImageUrl) throw new Error("No image to edit");

      const newImageUrl = await GeminiService.editImage(segment.generatedImageUrl, instruction);
      
      setStoryData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          segments: prev.segments.map(s => s.id === segmentId ? { ...s, generatedImageUrl: newImageUrl, isGenerating: false } : s)
        };
      });

    } catch(e) {
      console.error(e);
      setStoryData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: false } : s)
        };
      });
    }
  };

  const handlePlayAudio = async (text: string) => {
      // Use the currently selected voice from state
      const audioBuffer = await GeminiService.generateSpeech(text, selectedVoice);
      await GeminiService.playAudio(audioBuffer);
  };

  const handleExport = async () => {
    if (!storyData) return;
    try {
      await StorageService.exportProject(storyData);
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to export project.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await StorageService.importProject(file);
      setStoryData(data);
      setStatus(ProcessingStatus.READY);
      setActiveTab(Tab.STORYBOARD); // Go straight to storyboard on load
    } catch (e) {
      console.error("Import failed", e);
      alert("Failed to import project. Please ensure it is a valid zip file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-2xl text-center">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Access Required</h1>
          <p className="text-slate-400 mb-8">
            StoryBoard AI uses advanced Gemini models (Gemini 3 Pro & Imagen). 
            Please select a <strong>paid API key</strong> to continue.
          </p>
          
          <button 
            onClick={handleSelectKey}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg mb-6"
          >
            Select API Key
          </button>

          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1"
          >
            Learn about Gemini API billing <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-[#0f172a]/95 sticky top-0 z-50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Layout className="w-8 h-8 text-indigo-500" />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                StoryBoard AI
              </span>
            </div>
            
            <div className="flex items-center gap-4">
               {/* Export / Import Controls */}
               <div className="hidden md:flex gap-2">
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".zip" 
                    onChange={handleFileChange}
                 />
                 <button 
                   onClick={handleImportClick}
                   className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition-colors border border-slate-700"
                   title="Import Project"
                 >
                   <Upload className="w-4 h-4" /> Import
                 </button>
                 {storyData && (
                   <button 
                     onClick={handleExport}
                     className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition-colors border border-slate-700"
                     title="Export Project & Assets"
                   >
                     <Download className="w-4 h-4" /> Export
                   </button>
                 )}
               </div>

              {storyData && (
                <div className="flex bg-slate-800 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab(Tab.INPUT)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === Tab.INPUT ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    Story
                  </button>
                   <button
                    onClick={() => setActiveTab(Tab.ASSETS)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === Tab.ASSETS ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    Assets
                    <span className="bg-slate-900/50 px-1.5 rounded text-xs">{storyData.characters.length + storyData.settings.length}</span>
                  </button>
                   <button
                    onClick={() => setActiveTab(Tab.STORYBOARD)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === Tab.STORYBOARD ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    Storyboard
                    <span className="bg-slate-900/50 px-1.5 rounded text-xs">{storyData.segments.length}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === Tab.INPUT && (
          <div className="animate-fade-in">
             <StoryInput 
                onAnalyze={handleAnalyzeStory} 
                status={status} 
                selectedVoice={selectedVoice}
                onVoiceChange={setSelectedVoice}
             />
             {storyData && (
                <div className="mt-8 flex justify-center">
                   <button 
                    onClick={() => setActiveTab(Tab.ASSETS)}
                    className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-semibold"
                   >
                     Continue to Assets <ChevronRight className="w-4 h-4" />
                   </button>
                </div>
             )}
          </div>
        )}

        {activeTab === Tab.ASSETS && storyData && (
           <div className="animate-fade-in">
              <div className="mb-8 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                <h3 className="text-indigo-300 font-bold mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> 
                  Pre-production Phase
                </h3>
                <p className="text-sm text-indigo-200/80">
                  Generate visual references for your characters and settings first. These images will be fed into the Nano Banana Pro model to ensure consistency when generating the final scenes.
                </p>
              </div>
              <AssetGallery 
                characters={storyData.characters}
                settings={storyData.settings}
                onGenerateCharacter={handleGenerateCharacter}
                onGenerateSetting={handleGenerateSetting}
              />
           </div>
        )}

        {activeTab === Tab.STORYBOARD && storyData && (
          <div className="animate-fade-in">
             <Storyboard 
               segments={storyData.segments}
               characters={storyData.characters}
               settings={storyData.settings}
               onGenerateScene={handleGenerateScene}
               onEditImage={handleEditImage}
               onPlayAudio={handlePlayAudio}
             />
          </div>
        )}
      </main>
    </div>
  );
}