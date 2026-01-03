
import React, { useState, useEffect, useRef } from 'react';
import { Layout, Clapperboard, Layers, ChevronRight, Key, ExternalLink, Download, Upload, XCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
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
      if (aistudio) {
        try {
          const selected = await aistudio.hasSelectedApiKey();
          if (selected) setHasApiKey(true);
        } catch (e) { console.error("Error checking API key:", e); }
      }
    };
    checkKey();
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
      } catch (e) { console.error("Error selecting API key:", e); }
    }
  };

  const handleAnalyzeStory = async (text: string, style: string) => {
    setStatus(ProcessingStatus.ANALYZING);
    setError(null);
    addToast("Decomposing narrative structure...", "info");
    try {
      const data = await GeminiService.analyzeStoryText(text, style);
      const initializedSegments = data.segments.map(s => ({
          ...s,
          selectedGridIndices: [],
          generatedImageUrls: []
      }));
      setStoryData({ ...data, segments: initializedSegments });
      setStatus(ProcessingStatus.READY);
      setActiveTab(Tab.ASSETS);
      addToast("Analysis complete.", "success");
    } catch (error: any) {
      setStatus(ProcessingStatus.ERROR);
      setError("Analysis failed. Try shortening the text.");
      addToast("Analysis failed.", "error");
    }
  };

  const handleGenerateCharacter = async (id: string) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, isGenerating: true } : c) }) : null);
    addToast("Generating character sheet...", "info");
    try {
      const char = storyData.characters.find(c => c.id === id);
      if (!char) return;
      
      // Updated prompt for the specific Manhwa Model Sheet look
      const prompt = `Professional Manhwa Character Design Sheet for: ${char.name}.
      VISUAL STYLE: High-quality Korean Webtoon / Anime style. Cel-shaded coloring. Sharp, clean line art.
      
      LAYOUT REQUIREMENT:
      - Background: Pure solid WHITE background. No scenery.
      - Composition: 4 distinct poses arranged horizontally in a row.
      - Pose 1: Full Body Front View (Standing neutral).
      - Pose 2: Full Body Side View / Profile.
      - Pose 3: Full Body Back View.
      - Pose 4: Large Detailed Headshot/Face Close-up showing expression.
      
      CHARACTER DETAILS: ${char.description}.
      
      FORMAT: Technical Model Sheet. High resolution, clear details for 3D modeling reference.`;

      const imageUrl = await GeminiService.generateImage(
          prompt, 
          AspectRatio.WIDE, 
          ImageSize.K1, 
          [], 
          storyData.visualStyleGuide, 
          storyData.cinematicDNA, 
          false
      );

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
      // Enforce Manhwa style for settings too
      const prompt = `Manhwa Background Art: ${setting.name}. ${setting.description}. Style: Detailed Anime/Webtoon background, high quality, atmospheric lighting.`;
      
      const imageUrl = await GeminiService.generateImage(prompt, AspectRatio.WIDE, ImageSize.K1, [], storyData.visualStyleGuide, storyData.cinematicDNA, false);
      setStoryData(prev => prev ? ({ ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, imageUrl, isGenerating: false } : s) }) : null);
    } catch (e) {
      setStoryData(prev => prev ? ({ ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, isGenerating: false } : s) }) : null);
    }
  };

  const handleGenerateScene = async (segmentId: string, options: { aspectRatio: AspectRatio, imageSize: ImageSize }) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: true } : s) }) : null);
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
      
      const gridVariations = segment.panels ? segment.panels.map(p => p.visualPrompt) : [];

      const masterGridUrl = await GeminiService.generateImage(segment.scenePrompt, options.aspectRatio, options.imageSize, refImages, storyData.visualStyleGuide, storyData.cinematicDNA, true, gridVariations);
      
      const croppedImages = await Promise.all([0,1,2,3].map(i => cropGridCell(masterGridUrl, i)));

      setStoryData(prev => prev ? ({
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? { 
            ...s, 
            masterGridImageUrl: masterGridUrl, 
            selectedGridIndices: [0, 1, 2, 3], 
            generatedImageUrls: croppedImages,
            isGenerating: false 
        } : s)
      }) : null);
    } catch (e: any) {
       setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: false } : s) }) : null);
       addToast("Visual generation failed.", "error");
    }
  };

  const handleSelectOption = async (segmentId: string, optionIndex: number) => {
    if (!storyData) return;
    const segment = storyData.segments.find(s => s.id === segmentId);
    if (!segment || !segment.masterGridImageUrl) return;
    try {
        let newIndices = [...(segment.selectedGridIndices || [])];
        if (newIndices.includes(optionIndex)) newIndices = newIndices.filter(i => i !== optionIndex);
        else newIndices.push(optionIndex);
        
        newIndices.sort((a,b) => a-b);

        const newImages = await Promise.all(newIndices.map(async (idx) => await cropGridCell(segment.masterGridImageUrl!, idx)));
        
        setStoryData(prev => prev ? ({
            ...prev,
            segments: prev.segments.map(s => s.id === segmentId ? { ...s, selectedGridIndices: newIndices, generatedImageUrls: newImages } : s)
        }) : null);
    } catch (e) { console.error(e); }
  };

  const handleDeleteAudio = (segmentId: string) => {
     if (!storyData) return;
     setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, audioUrl: undefined, audioDuration: undefined } : s) }) : null);
  };

  const handleGenerateAndPlayAudio = async (segmentId: string, text: string): Promise<void> => {
      const segment = storyData?.segments.find(s => s.id === segmentId);
      if (segment?.audioUrl) {
          const audio = new Audio(segment.audioUrl);
          await audio.play();
          return;
      }
      setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: true } : s) }) : null);
      try {
          const audioBuffer = await GeminiService.generateSpeech(text, selectedVoice);
          const blob = GeminiService.createWavBlob(audioBuffer);
          const url = URL.createObjectURL(blob);
          const duration = audioBuffer.byteLength / 48000;
          setStoryData(prev => prev ? ({
              ...prev, 
              segments: prev.segments.map(s => s.id === segmentId ? { ...s, audioUrl: url, audioDuration: duration, isGenerating: false } : s)
          }) : null);
      } catch (e) {
          setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: false } : s) }) : null);
      }
  };

  const handleStopAudio = () => GeminiService.stopAudio();
  const handleExport = async () => { if (storyData) await StorageService.exportProject(storyData); };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data } = await StorageService.importProject(file);
      setStoryData(data);
      setStatus(ProcessingStatus.READY);
      setActiveTab(Tab.STORYBOARD);
      addToast("Project imported.", "success");
    } catch (e) { alert("Import failed."); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 relative z-50">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-2xl text-center">
          <Key className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Access Required</h1>
          <button onClick={handleSelectKey} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-lg">Select API Key</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 relative z-50">
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

      <nav className="border-b border-slate-800 bg-[#0f172a]/95 sticky top-0 z-50 backdrop-blur h-16 flex items-center px-4 md:px-8 justify-between">
          <div className="flex items-center gap-2">
              <Layout className="w-8 h-8 text-indigo-500" />
              <span className="text-xl font-bold">StoryBoard AI</span>
          </div>
          <div className="flex gap-4">
               <input type="file" ref={fileInputRef} className="hidden" accept=".zip" onChange={handleFileChange} />
               <button onClick={handleImportClick} className="px-3 py-1.5 bg-slate-800 rounded border border-slate-700 flex items-center gap-2"><Upload className="w-4 h-4" /> Import</button>
               {storyData && <button onClick={handleExport} className="px-3 py-1.5 bg-slate-800 rounded border border-slate-700 flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
               {storyData && (
                <div className="flex bg-slate-800 rounded p-1">
                  <button onClick={() => setActiveTab(Tab.INPUT)} className={`px-4 py-1.5 rounded text-sm ${activeTab === Tab.INPUT ? 'bg-indigo-600' : ''}`}>Story</button>
                  <button onClick={() => setActiveTab(Tab.ASSETS)} className={`px-4 py-1.5 rounded text-sm ${activeTab === Tab.ASSETS ? 'bg-indigo-600' : ''}`}>Characters</button>
                  <button onClick={() => setActiveTab(Tab.STORYBOARD)} className={`px-4 py-1.5 rounded text-sm ${activeTab === Tab.STORYBOARD ? 'bg-indigo-600' : ''}`}>Manga Panels</button>
                </div>
              )}
          </div>
      </nav>
      <main className="max-w-[1600px] mx-auto px-4 py-8">
        {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-4 text-red-200">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold text-red-400">Error</h3>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
        )}

        {activeTab === Tab.INPUT && <StoryInput onAnalyze={handleAnalyzeStory} status={status} selectedVoice={selectedVoice} onVoiceChange={setSelectedVoice} />}
        {activeTab === Tab.ASSETS && storyData && <AssetGallery characters={storyData.characters} settings={storyData.settings} onGenerateCharacter={handleGenerateCharacter} onGenerateSetting={handleGenerateSetting} />}
        {activeTab === Tab.STORYBOARD && storyData && <Storyboard 
            segments={storyData.segments} 
            onGenerateScene={handleGenerateScene} 
            onGenerateVideo={(id, idx) => addToast("Video Generation available in next update", "info")}
            onSelectOption={handleSelectOption} 
            onPlayAudio={handleGenerateAndPlayAudio} 
            onStopAudio={handleStopAudio} 
            onDeleteAudio={handleDeleteAudio} 
        />}
      </main>
    </div>
  );
}
