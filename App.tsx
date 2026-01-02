
import React, { useState, useEffect, useRef } from 'react';
import { Layout, Key, Upload, Download, XCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import StoryInput from './components/StoryInput';
import AssetGallery from './components/AssetGallery';
import Storyboard from './components/Storyboard';
import { StoryData, ProcessingStatus, AspectRatio, ImageSize } from './types';
import * as GeminiService from './services/geminiService';
import * as StorageService from './services/storageService';
import { cropGridCell } from './utils/imageUtils';

enum Tab { INPUT = 'input', ASSETS = 'assets', STORYBOARD = 'storyboard' }

interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INPUT);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string, type: string, message: string }[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('Puck');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = (message: string, type: string = 'info') => {
      const id = Math.random().toString(36).substring(7);
      setToasts(prev => [...prev, { id, type, message }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 6000);
  };

  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio as AIStudio | undefined;
      if (aistudio && (await aistudio.hasSelectedApiKey())) setHasApiKey(true);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio as AIStudio | undefined;
    if (aistudio) { await aistudio.openSelectKey(); setHasApiKey(true); }
  };

  const handleAnalyzeStory = async (text: string, style: string) => {
    setStatus(ProcessingStatus.ANALYZING);
    setError(null);
    addToast("Decomposing narrative structure...", "info");
    try {
      const data = await GeminiService.analyzeStoryText(text, style);
      setStoryData({ ...data, segments: data.segments.map(s => ({ ...s, selectedGridIndices: [], generatedImageUrls: [] })) });
      setStatus(ProcessingStatus.READY);
      setActiveTab(Tab.ASSETS); // Go to Assets first to generate characters
      addToast("Analysis complete.", "success");
    } catch (e: any) {
      console.error("Analysis Error:", e);
      setStatus(ProcessingStatus.ERROR);
      setError(e.message || "Failed to analyze story.");
      addToast("Analysis failed.", "error");
    }
  };

  const handleGenerateCharacter = async (id: string) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, isGenerating: true } : c) }) : null);
    addToast("Generating side-by-side character sheet...", "info");
    try {
      const char = storyData.characters.find(c => c.id === id);
      if (!char) return;
      
      const prompt = `Side by side photo of a closeup face, and full body character design, of ${char.name}, ${char.description}. On the left, a tight closeup of their face and shoulders. On the right, their whole form is framed. They are wearing a detailed outfit consistent with: ${char.description}. On a flat dark slate background, captured in photography style with edge lighting for depth to separate them from the darkness, 8k, photorealistic, consistency in clothing across both panels.`;

      // Use LANDSCAPE to accommodate the side-by-side nature effectively
      const imageUrl = await GeminiService.generateImage(prompt, AspectRatio.LANDSCAPE, ImageSize.K1);
      
      setStoryData(prev => prev ? ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, imageUrl, isGenerating: false } : c) }) : null);
    } catch (e) {
      setStoryData(prev => prev ? ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, isGenerating: false } : c) }) : null);
      addToast("Character generation failed.", "error");
    }
  };

  const handleGenerateSetting = async (id: string) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({ ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, isGenerating: true } : s) }) : null);
    try {
      const setting = storyData.settings.find(s => s.id === id);
      if (!setting) return;
      const imageUrl = await GeminiService.generateImage(`Environment Art: ${setting.name}. ${setting.description}. Style: ${storyData.artStyle}`, AspectRatio.LANDSCAPE, ImageSize.K1);
      setStoryData(prev => prev ? ({ ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, imageUrl, isGenerating: false } : s) }) : null);
    } catch (e) {
      setStoryData(prev => prev ? ({ ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, isGenerating: false } : s) }) : null);
    }
  };

  const handleGenerateVideoPrompts = async (segmentId: string) => {
     if (!storyData) return;
     setStoryData(prev => prev ? ({...prev, segments: prev.segments.map(s => s.id === segmentId ? {...s, isGenerating: true} : s)}) : null);
     addToast("Generating motion prompts for selected beats...", "info");
     try {
       const segment = storyData.segments.find(s => s.id === segmentId);
       if (!segment || !segment.gridVariations) return;
       
       const prompts = await GeminiService.generateBeatPrompts(segment.text, segment.gridVariations, segment.selectedGridIndices);
       
       setStoryData(prev => prev ? ({
         ...prev,
         segments: prev.segments.map(s => s.id === segmentId ? { ...s, beatPrompts: prompts, isGenerating: false } : s)
       }) : null);
       addToast("Motion prompts generated!", "success");
     } catch (e) {
       setStoryData(prev => prev ? ({...prev, segments: prev.segments.map(s => s.id === segmentId ? {...s, isGenerating: false} : s)}) : null);
       addToast("Failed to generate motion prompts", "error");
     }
  };

  const handleGenerateVideo = async (segmentId: string, imageIndex: number) => {
    if (!storyData) return;
    
    // We flag the whole segment as video generating for now, or you could do it per beat if you change the type
    setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isVideoGenerating: true } : s) }) : null);
    addToast("Rendering cinematic video (Veo 3.1)...", "info");
    try {
      const segment = storyData.segments.find(s => s.id === segmentId);
      if (!segment || !segment.generatedImageUrls[imageIndex]) return;
      
      const prompt = segment.beatPrompts?.[segment.selectedGridIndices[imageIndex]] || segment.scenePrompt;
      const image = segment.generatedImageUrls[imageIndex];

      // Note: In a multi-video setup, you might want to store an array of videoUrls. 
      // For this simplified version, we'll just overwrite the main videoUrl for previewing.
      
      const { url, videoObject } = await GeminiService.generateInitialVideo(prompt, image);
      setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, videoUrl: url, videoObject, isVideoGenerating: false } : s) }) : null);
      addToast("Video beat ready!", "success");
    } catch (e: any) {
      setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isVideoGenerating: false } : s) }) : null);
      addToast(`Video failed: ${e.message}`, "error");
    }
  };

  const handleGenerateScene = async (segmentId: string, options: { aspectRatio: AspectRatio, imageSize: ImageSize }) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: true } : s) }) : null);
    try {
      const segment = storyData.segments.find(s => s.id === segmentId);
      if (!segment) throw new Error();
      
      const refImages: string[] = [];
      segment.characterIds.forEach(charId => {
         const char = storyData.characters.find(c => c.id === charId);
         if (char?.imageUrl) refImages.push(char.imageUrl);
      });

      // Simple prompt + Grid request
      const gridUrl = await GeminiService.generateImage(segment.scenePrompt, AspectRatio.MOBILE, options.imageSize, refImages, storyData.artStyle, {}, true, segment.gridVariations);
      
      // We don't auto-crop anymore, user selects manually
      setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, masterGridImageUrl: gridUrl, selectedGridIndices: [], generatedImageUrls: [], isGenerating: false } : s) }) : null);
    } catch (e) {
       setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: false } : s) }) : null);
       addToast("Visual generation failed.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      {/* Toast Overlay */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border border-white/10 backdrop-blur-md animate-fade-in ${t.type === 'error' ? 'bg-red-500/90' : t.type === 'success' ? 'bg-emerald-500/90' : 'bg-slate-800/90'} text-white`}>
            {t.type === 'error' && <XCircle className="w-5 h-5 shrink-0" />}
            {t.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0" />}
            {t.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">{t.message}</span>
          </div>
        ))}
      </div>

      {!hasApiKey ? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 border border-slate-700 text-center shadow-2xl">
            <Key className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">Gemini AI Engine</h1>
            <p className="text-slate-400 mb-8 text-sm">Please select a paid API key to unlock cinematic story analysis and Veo video generation.</p>
            <button onClick={handleSelectKey} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-lg transition-all">Select Key & Start</button>
          </div>
        </div>
      ) : (
        <>
          <nav className="border-b border-slate-800 bg-[#0f172a]/95 sticky top-0 z-50 backdrop-blur h-16 flex items-center px-4 md:px-8 justify-between">
              <div className="flex items-center gap-2">
                  <Layout className="w-8 h-8 text-indigo-500" />
                  <span className="text-xl font-bold tracking-tight">StoryBoard AI</span>
              </div>
              <div className="flex gap-4">
                  <input type="file" ref={fileInputRef} className="hidden" accept=".zip" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      try {
                        const { data } = await StorageService.importProject(file);
                        setStoryData(data); setActiveTab(Tab.STORYBOARD);
                        addToast("Project imported.", "success");
                      } catch(err) { addToast("Import failed.", "error"); }
                  }} />
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-xs font-bold flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Import ZIP
                  </button>
                  {storyData && (
                    <div className="flex bg-slate-800 rounded p-1">
                      <button onClick={() => setActiveTab(Tab.INPUT)} className={`px-4 py-1.5 rounded text-xs font-bold ${activeTab === Tab.INPUT ? 'bg-indigo-600' : ''}`}>STORY</button>
                      <button onClick={() => setActiveTab(Tab.ASSETS)} className={`px-4 py-1.5 rounded text-xs font-bold ${activeTab === Tab.ASSETS ? 'bg-indigo-600' : ''}`}>ASSETS</button>
                      <button onClick={() => setActiveTab(Tab.STORYBOARD)} className={`px-4 py-1.5 rounded text-xs font-bold ${activeTab === Tab.STORYBOARD ? 'bg-indigo-600' : ''}`}>BOARD</button>
                    </div>
                  )}
              </div>
          </nav>
          
          <main className="max-w-[1600px] mx-auto px-4 py-8">
            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-4 text-red-200">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold text-red-400">Analysis Error</h3>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}

            {activeTab === Tab.INPUT && <StoryInput onAnalyze={handleAnalyzeStory} status={status} selectedVoice={selectedVoice} onVoiceChange={setSelectedVoice} />}
            {activeTab === Tab.ASSETS && storyData && <AssetGallery characters={storyData.characters} settings={storyData.settings} onGenerateCharacter={handleGenerateCharacter} onGenerateSetting={handleGenerateSetting} />}
            {activeTab === Tab.STORYBOARD && storyData && <Storyboard 
                segments={storyData.segments} 
                onGenerateScene={handleGenerateScene} 
                onGenerateVideoPrompts={handleGenerateVideoPrompts}
                onGenerateVideo={handleGenerateVideo}
                onSelectOption={async (id, idx) => {
                   const seg = storyData.segments.find(s => s.id === id);
                   if (!seg?.masterGridImageUrl) return;
                   
                   // Toggle logic
                   let newIndices = [...(seg.selectedGridIndices || [])];
                   if (newIndices.includes(idx)) {
                       // Remove
                       newIndices = newIndices.filter(i => i !== idx);
                   } else {
                       // Add
                       newIndices.push(idx);
                   }
                   
                   // We re-generate the cropped images array based on selection
                   const newImages = await Promise.all(newIndices.map(async (i) => await cropGridCell(seg.masterGridImageUrl!, i)));

                   setStoryData(p => p ? ({...p, segments: p.segments.map(s => s.id === id ? {...s, selectedGridIndices: newIndices, generatedImageUrls: newImages} : s)}) : null);
                }} 
                onPlayAudio={async (id, text) => {
                    setStoryData(p => p ? ({...p, segments: p.segments.map(s => s.id === id ? {...s, isGenerating: true} : s)}) : null);
                    try {
                      const buf = await GeminiService.generateSpeech(text, selectedVoice);
                      const url = URL.createObjectURL(GeminiService.createWavBlob(buf));
                      setStoryData(p => p ? ({...p, segments: p.segments.map(s => s.id === id ? {...s, audioUrl: url, isGenerating: false} : s)}) : null);
                    } catch(e) { setStoryData(p => p ? ({...p, segments: p.segments.map(s => s.id === id ? {...s, isGenerating: false} : s)}) : null); }
                }} 
                onStopAudio={GeminiService.stopAudio} 
                onDeleteAudio={id => setStoryData(p => p ? ({...p, segments: p.segments.map(s => s.id === id ? {...s, audioUrl: undefined} : s)}) : null)} />}
          </main>
        </>
      )}
    </div>
  );
}
