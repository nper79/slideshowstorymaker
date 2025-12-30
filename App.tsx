import React, { useState, useEffect, useRef } from 'react';
import { Layout, Clapperboard, Layers, ChevronRight, Key, ExternalLink, Download, Upload, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import StoryInput from './components/StoryInput';
import AssetGallery from './components/AssetGallery';
import Storyboard from './components/Storyboard';
import { StoryData, ProcessingStatus, AspectRatio, ImageSize } from './types';
import * as GeminiService from './services/geminiService';
import * as StorageService from './services/storageService';
import { cropGridCell } from './utils/imageUtils';

enum Tab {
  INPUT = 'input',
  ASSETS = 'assets',
  STORYBOARD = 'storyboard'
}

interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

// --- TOAST SYSTEM ---
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const ToastContainer: React.FC<{ toasts: Toast[], removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border border-white/10 backdrop-blur-md animate-slide-in-right
            ${toast.type === 'error' ? 'bg-red-500/90 text-white' : ''}
            ${toast.type === 'success' ? 'bg-emerald-500/90 text-white' : ''}
            ${toast.type === 'info' ? 'bg-slate-800/90 text-white' : ''}
          `}
        >
          {toast.type === 'error' && <XCircle className="w-5 h-5 shrink-0" />}
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="ml-2 opacity-70 hover:opacity-100">
             <XCircle className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INPUT);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice selection state (default to 'Puck')
  const [selectedVoice, setSelectedVoice] = useState('Puck');

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = Math.random().toString(36).substring(7);
      setToasts(prev => [...prev, { id, type, message }]);
      setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleError = (e: any, defaultMsg: string) => {
      console.error(e);
      const msg = e.toString();
      if (msg.includes("429")) {
          addToast("Rate Limit Exceeded. Please wait a moment before trying again.", "error");
      } else if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
          addToast("Permission Denied. Check your API Key billing status.", "error");
          setHasApiKey(false);
      } else if (msg.includes("400")) {
          addToast("The AI request was invalid. Try shortening the text.", "error");
      } else {
          addToast(`${defaultMsg}: ${e.message || "Unknown error"}`, "error");
      }
  };

  useEffect(() => {
    // 1. Check API Key
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

    // 2. Generic Cleanup for background artifacts
    const cleanupBackground = () => {
        const canvases = document.querySelectorAll('body > canvas');
        canvases.forEach((c: any) => {
            c.style.display = 'none';
            if(c.parentNode) c.parentNode.removeChild(c);
        });
    };
    cleanupBackground();
    
    const interval = setInterval(cleanupBackground, 500);
    return () => clearInterval(interval);

  }, []);

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio as AIStudio | undefined;
    if (aistudio) {
      try {
        await aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Error selecting API key:", e);
      }
    }
  };

  const handleAnalyzeStory = async (text: string, style: string) => {
    setStatus(ProcessingStatus.ANALYZING);
    addToast("Analyzing story structure...", "info");
    try {
      const data = await GeminiService.analyzeStoryText(text, style);
      // Initialize new fields
      const initializedSegments = data.segments.map(s => ({
          ...s,
          selectedGridIndices: [], // Start empty
          generatedImageUrls: []
      }));
      
      setStoryData({ ...data, segments: initializedSegments });
      setStatus(ProcessingStatus.READY);
      setActiveTab(Tab.ASSETS);
      addToast("Story analyzed successfully!", "success");
    } catch (error: any) {
      setStatus(ProcessingStatus.ERROR);
      handleError(error, "Failed to analyze story");
    }
  };

  const handleGenerateCharacter = async (id: string) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({
        ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, isGenerating: true } : c)
    }) : null);

    try {
      const char = storyData.characters.find(c => c.id === id);
      if (!char) return;
      const prompt = `Character Sheet Concept Art. Full Body. Front View and Back View side-by-side. Solid White Background. High detail. Character Name: ${char.name}. Description: ${char.description}. Visual Notes: ${char.visualPrompt}.`;
      
      const imageUrl = await GeminiService.generateImage(prompt, AspectRatio.PORTRAIT, ImageSize.K1, [], storyData.visualStyleGuide, storyData.cinematicDNA, false);

      setStoryData(prev => prev ? ({
        ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, imageUrl, isGenerating: false } : c)
      }) : null);
      addToast(`Generated character: ${char.name}`, "success");
    } catch (e) {
      handleError(e, "Character generation failed");
      setStoryData(prev => prev ? ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, isGenerating: false } : c) }) : null);
    }
  };

  const handleGenerateSetting = async (id: string) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({
        ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, isGenerating: true } : s)
    }) : null);

    try {
      const setting = storyData.settings.find(s => s.id === id);
      if (!setting) return;
      const prompt = `Aerial view. Architecture view of location. Top-down plan. Setting: ${setting.name}. Description: ${setting.description}. ${setting.visualPrompt}.`;
      
      const imageUrl = await GeminiService.generateImage(prompt, AspectRatio.LANDSCAPE, ImageSize.K1, [], storyData.visualStyleGuide, storyData.cinematicDNA, false);

      setStoryData(prev => prev ? ({
        ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, imageUrl, isGenerating: false } : s)
      }) : null);
      addToast(`Generated setting: ${setting.name}`, "success");
    } catch (e) {
      handleError(e, "Setting generation failed");
      setStoryData(prev => prev ? ({ ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, isGenerating: false } : s) }) : null);
    }
  };

  const handleGenerateScene = async (segmentId: string, options: { aspectRatio: AspectRatio, imageSize: ImageSize }) => {
    if (!storyData) return;

    setStoryData(prev => prev ? ({
      ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: true } : s)
    }) : null);

    try {
      const segment = storyData.segments.find(s => s.id === segmentId);
      if (!segment) throw new Error("Segment not found");

      const refImages: string[] = [];
      segment.characterIds.forEach(charId => {
        const char = storyData.characters.find(c => c.id === charId);
        if (char?.imageUrl) refImages.push(char.imageUrl);
      });
      const setting = storyData.settings.find(s => s.id === segment.settingId);
      if (setting?.imageUrl) refImages.push(setting.imageUrl);
      
      const prompt = `
        Time of Day: ${segment.timeOfDay}. 
        Key Visual Action: ${segment.keyVisualAction}.
        Scene Details: ${segment.scenePrompt}
        Setting: ${setting?.name || 'Unknown'}, in the ${segment.quadrant}.
        Characters present: ${segment.characterIds.map(id => storyData.characters.find(c => c.id === id)?.name).join(', ')}.
      `;

      // GENERATE A 3x3 GRID
      const masterGridUrl = await GeminiService.generateImage(
        prompt, 
        options.aspectRatio, 
        options.imageSize, 
        refImages, 
        storyData.visualStyleGuide, 
        storyData.cinematicDNA, 
        true, 
        segment.gridVariations 
      );

      // Default to center image (index 4)
      const defaultIndex = 4;
      const croppedImage = await cropGridCell(masterGridUrl, defaultIndex);

      setStoryData(prev => prev ? ({
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? { 
            ...s, 
            masterGridImageUrl: masterGridUrl, 
            selectedGridIndices: [defaultIndex], // Initialize as array
            generatedImageUrls: [croppedImage], // Initialize as array
            isGenerating: false 
        } : s)
      }) : null);
      addToast("Scene grid generated!", "success");

    } catch (e: any) {
       handleError(e, "Scene generation failed");
       setStoryData(prev => prev ? ({
          ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: false } : s)
       }) : null);
    }
  };

  // UPDATED: Handle multi-select toggle
  const handleSelectOption = async (segmentId: string, optionIndex: number) => {
    if (!storyData) return;
    
    const segment = storyData.segments.find(s => s.id === segmentId);
    if (!segment || !segment.masterGridImageUrl) return;

    try {
        let newIndices = [...(segment.selectedGridIndices || [])];
        
        // Toggle logic
        if (newIndices.includes(optionIndex)) {
            newIndices = newIndices.filter(i => i !== optionIndex);
        } else {
            newIndices.push(optionIndex);
        }

        // Re-generate the array of cropped images based on the new index order
        const newImages = await Promise.all(
            newIndices.map(async (idx) => {
                return await cropGridCell(segment.masterGridImageUrl!, idx);
            })
        );

        setStoryData(prev => {
            if (!prev) return null;
            return {
                ...prev,
                segments: prev.segments.map(s => s.id === segmentId ? {
                    ...s,
                    selectedGridIndices: newIndices,
                    generatedImageUrls: newImages
                } : s)
            };
        });
    } catch (e) {
        console.error("Failed to crop grid cell", e);
        addToast("Failed to update selection", "error");
    }
  };

  const handleEditImage = async (segmentId: string, instruction: string) => {
      if (!storyData) return;

      const segment = storyData.segments.find(s => s.id === segmentId);
      if (!segment || !segment.generatedImageUrls || segment.generatedImageUrls.length === 0) return;

      setStoryData(prev => prev ? ({
          ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: true } : s)
      }) : null);

      try {
          const originalUrl = segment.generatedImageUrls[0];
          const newImageUrl = await GeminiService.editImage(originalUrl, instruction);
          
          setStoryData(prev => prev ? ({
              ...prev,
              segments: prev.segments.map(s => s.id === segmentId ? { 
                  ...s, 
                  // Replace the first image with the edited version
                  generatedImageUrls: [newImageUrl, ...s.generatedImageUrls.slice(1)],
                  isGenerating: false 
              } : s)
          }) : null);
          addToast("Image edited successfully", "success");
      } catch(e) {
          handleError(e, "Image edit failed");
          setStoryData(prev => prev ? ({
              ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: false } : s)
          }) : null);
      }
  };

  const handleDeleteAudio = (segmentId: string) => {
     if (!storyData) return;
     setStoryData(prev => prev ? ({
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? {
            ...s,
            audioUrl: undefined,
            audioDuration: undefined
        } : s)
     }) : null);
     addToast("Audio deleted", "info");
  };

  // Modified to generate AND store the audio blob
  const handleGenerateAndPlayAudio = async (segmentId: string, text: string): Promise<void> => {
      const segment = storyData?.segments.find(s => s.id === segmentId);
      
      // If audio already exists, just play it
      if (segment?.audioUrl) {
          try {
             const audio = new Audio(segment.audioUrl);
             await audio.play();
          } catch(err) {
             console.error("Playback failed on existing audio", err);
             addToast("Playback failed. Try regenerating audio.", "error");
          }
          return;
      }

      setStoryData(prev => prev ? ({
          ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: true } : s)
      }) : null);
      addToast("Generating audio...", "info");

      try {
          // Generate raw buffer
          const audioBuffer = await GeminiService.generateSpeech(text, selectedVoice);
          
          if (!audioBuffer || audioBuffer.byteLength === 0) {
              throw new Error("Empty audio buffer received");
          }

          // Create PROPER Wav Blob for download/playback
          const blob = GeminiService.createWavBlob(audioBuffer);
          const url = URL.createObjectURL(blob);
          
          // Calculate duration mathematically (SampleRate=24000, Channels=1, Bits=16/2bytes)
          // 48000 bytes per second
          const duration = audioBuffer.byteLength / 48000;

          // Update state with URL and duration
          setStoryData(prev => prev ? ({
              ...prev, 
              segments: prev.segments.map(s => s.id === segmentId ? { 
                  ...s, 
                  audioUrl: url,
                  audioDuration: duration,
                  isGenerating: false 
              } : s)
          }) : null);

          addToast("Audio generated!", "success");

          // Play immediately
          try {
             const audio = new Audio(url);
             await audio.play();
          } catch(err) {
             console.warn("Auto-play failed", err);
             addToast("Audio ready. Click play to listen.", "info");
          }

      } catch (e) {
          handleError(e, "Audio generation failed");
          setStoryData(prev => prev ? ({
              ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: false } : s)
          }) : null);
      }
  };

  const handleStopAudio = () => {
    GeminiService.stopAudio();
  };

  const handleExport = async () => {
    if (!storyData) return;
    try {
      await StorageService.exportProject(storyData);
      addToast("Project exported successfully", "success");
    } catch (e) {
      handleError(e, "Failed to export project");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addToast("Importing project...", "info");
    try {
      // Updated to receive warnings
      const { data, warnings } = await StorageService.importProject(file);
      
      setStoryData(data);
      setStatus(ProcessingStatus.READY);
      setActiveTab(Tab.STORYBOARD);
      
      if (warnings && warnings.length > 0) {
          warnings.forEach(w => addToast(w, "info"));
      } else {
          addToast("Project imported successfully", "success");
      }
      
    } catch (e) {
      handleError(e, "Failed to import project");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 relative z-50">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-2xl text-center">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Access Required</h1>
          <p className="text-slate-400 mb-8">
            StoryBoard AI uses advanced Gemini models (Gemini 3 Pro & Imagen). 
            Please select a <strong>paid API key</strong> to continue.
          </p>
          <button onClick={handleSelectKey} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg mb-6">
            Select API Key
          </button>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1">
            Learn about Gemini API billing <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 relative z-50">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
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
               <div className="hidden md:flex gap-2">
                 <input type="file" ref={fileInputRef} className="hidden" accept=".zip" onChange={handleFileChange} />
                 <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition-colors border border-slate-700">
                   <Upload className="w-4 h-4" /> Import
                 </button>
                 {storyData && (
                   <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition-colors border border-slate-700">
                     <Download className="w-4 h-4" /> Export
                   </button>
                 )}
               </div>
              {storyData && (
                <div className="flex bg-slate-800 rounded-lg p-1">
                  <button onClick={() => setActiveTab(Tab.INPUT)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === Tab.INPUT ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Story</button>
                   <button onClick={() => setActiveTab(Tab.ASSETS)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === Tab.ASSETS ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Assets</button>
                   <button onClick={() => setActiveTab(Tab.STORYBOARD)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === Tab.STORYBOARD ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Storyboard</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === Tab.INPUT && (
          <div className="animate-fade-in">
             <StoryInput onAnalyze={handleAnalyzeStory} status={status} selectedVoice={selectedVoice} onVoiceChange={setSelectedVoice} />
             {storyData && (
                <div className="mt-8 flex justify-center">
                   <button onClick={() => setActiveTab(Tab.ASSETS)} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-semibold">
                     Continue to Assets <ChevronRight className="w-4 h-4" />
                   </button>
                </div>
             )}
          </div>
        )}
        {activeTab === Tab.ASSETS && storyData && (
           <div className="animate-fade-in">
              <AssetGallery characters={storyData.characters} settings={storyData.settings} onGenerateCharacter={handleGenerateCharacter} onGenerateSetting={handleGenerateSetting} />
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
               onPlayAudio={handleGenerateAndPlayAudio}
               onStopAudio={handleStopAudio}
               onSelectOption={handleSelectOption}
               onDeleteAudio={handleDeleteAudio}
             />
          </div>
        )}
      </main>
    </div>
  );
}