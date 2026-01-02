
import React, { useState, useEffect, useRef } from 'react';
import { Layout, Key, AlertTriangle, Upload, Download, Layers, Users, Clapperboard } from 'lucide-react';
import StoryInput from './components/StoryInput';
import AssetGallery from './components/AssetGallery';
import Storyboard from './components/Storyboard';
import { StoryData, ProcessingStatus, AspectRatio, ImageSize } from './types';
import * as GeminiService from './services/geminiService';
import * as StorageService from './services/storageService';
import { splitCombinedKeyframes } from './utils/imageUtils';

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
  const [selectedVoice, setSelectedVoice] = useState('Puck');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    try {
      const data = await GeminiService.analyzeStoryText(text, style);
      setStoryData(data);
      setStatus(ProcessingStatus.READY);
      setActiveTab(Tab.ASSETS); // Auto-navigate to assets after analysis
    } catch (e: any) {
      console.error(e);
      setStatus(ProcessingStatus.ERROR);
      setError("Analysis failed. Please try again.");
    }
  };

  // --- ASSET GENERATION HANDLERS ---

  const handleGenerateCharacter = async (id: string) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, isGenerating: true } : c) }) : null);
    try {
      const char = storyData.characters.find(c => c.id === id);
      if (!char) return;
      
      // Prompt ajustado: Usa a descrição rica diretamente, mantendo apenas a estrutura técnica do side-by-side
      const prompt = `Side by side split screen character design, 4:3 aspect ratio. Left side: Close-up portrait of ${char.name}, looking at camera, neutral expression. Right side: Full body shot of ${char.name}, neutral pose. Visual details: ${char.description}. Style: ${storyData.artStyle}. High quality, photorealistic, NO text.`;

      const imageUrl = await GeminiService.generateImage(
        prompt, 
        AspectRatio.STANDARD, // 4:3 para acomodar lado a lado
        ImageSize.K1
      );
      setStoryData(prev => prev ? ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, imageUrl, isGenerating: false } : c) }) : null);
    } catch (e) {
      setStoryData(prev => prev ? ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, isGenerating: false } : c) }) : null);
    }
  };

  const handleGenerateSetting = async (id: string) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({ ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, isGenerating: true } : s) }) : null);
    try {
      const setting = storyData.settings.find(s => s.id === id);
      if (!setting) return;
      // Removido "Environment Concept Art" para usar a descrição detalhada diretamente
      const prompt = `${setting.name}: ${setting.description}. Style: ${storyData.artStyle}`;
      
      const imageUrl = await GeminiService.generateImage(
        prompt, 
        AspectRatio.LANDSCAPE, 
        ImageSize.K1
      );
      setStoryData(prev => prev ? ({ ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, imageUrl, isGenerating: false } : s) }) : null);
    } catch (e) {
      setStoryData(prev => prev ? ({ ...prev, settings: prev.settings.map(s => s.id === id ? { ...s, isGenerating: false } : s) }) : null);
    }
  };

  // --- STORYBOARD HANDLERS ---

  const handleGenerateKeyframes = async (segmentId: string) => {
    if (!storyData) return;
    setStoryData(prev => prev ? ({
      ...prev,
      segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGeneratingKeyframes: true } : s)
    }) : null);

    try {
      const segment = storyData.segments.find(s => s.id === segmentId);
      if (!segment) return;
      
      // Collect reference images from characters/settings involved in this segment
      const refImages: string[] = [];
      segment.characterIds.forEach(charId => {
        const char = storyData.characters.find(c => c.id === charId);
        if (char?.imageUrl) refImages.push(char.imageUrl);
      });
      const setting = storyData.settings.find(s => s.id === segment.settingId);
      if (setting?.imageUrl) refImages.push(setting.imageUrl);

      // Geramos a imagem 4:3 (STANDARD) que contém ambos os frames
      const combinedUrl = await GeminiService.generateImage(segment.combinedKeyframePrompt, AspectRatio.STANDARD, ImageSize.K1, refImages);
      
      // Cortamos a imagem em Start (Left) e End (Right)
      const { start, end } = await splitCombinedKeyframes(combinedUrl);
      
      setStoryData(prev => prev ? ({
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? { 
          ...s, 
          combinedKeyframeUrl: combinedUrl,
          startFrameUrl: start,
          endFrameUrl: end,
          isGeneratingKeyframes: false 
        } : s)
      }) : null);
    } catch (e) {
      setStoryData(prev => prev ? ({
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGeneratingKeyframes: false } : s)
      }) : null);
    }
  };

  const handleGenerateVideo = async (segmentId: string) => {
    if (!storyData) return;
    const segment = storyData.segments.find(s => s.id === segmentId);
    if (!segment || !segment.startFrameUrl || !segment.endFrameUrl) return;

    setStoryData(prev => prev ? ({
      ...prev,
      segments: prev.segments.map(s => s.id === segmentId ? { ...s, isVideoGenerating: true } : s)
    }) : null);

    try {
      const prompt = `Smooth cinematic transition from the first frame to the second frame. Action: ${segment.text}. Style: ${storyData.artStyle}. High quality animation.`;
      const { url, videoObject } = await GeminiService.generateVideoBetweenFrames(prompt, segment.startFrameUrl, segment.endFrameUrl);
      
      setStoryData(prev => prev ? ({
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? { ...s, videoUrl: url, videoObject, isVideoGenerating: false } : s)
      }) : null);
    } catch (e) {
      setStoryData(prev => prev ? ({
        ...prev,
        segments: prev.segments.map(s => s.id === segmentId ? { ...s, isVideoGenerating: false } : s)
      }) : null);
    }
  };

  const handleUpdateDuration = (segmentId: string, duration: number) => {
     setStoryData(prev => prev ? ({
      ...prev,
      segments: prev.segments.map(s => s.id === segmentId ? { ...s, audioDuration: duration } : s)
    }) : null);
  };

  // --- AUDIO HANDLER ---
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
          
          await GeminiService.playAudio(audioBuffer);
      } catch (e) {
          setStoryData(prev => prev ? ({ ...prev, segments: prev.segments.map(s => s.id === segmentId ? { ...s, isGenerating: false } : s) }) : null);
      }
  };

  // --- PROJECT MANAGEMENT ---

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
    } catch (e) { alert("Import failed."); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      {!hasApiKey ? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-3xl p-10 border border-slate-700 text-center shadow-2xl">
            <Key className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">Cinematic Engine</h1>
            <p className="text-slate-400 mb-8 text-sm">Select a paid API key to begin generating AI-powered cinematic storyboards.</p>
            <button onClick={handleSelectKey} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold transition-all">Select API Key</button>
          </div>
        </div>
      ) : (
        <>
          <nav className="border-b border-slate-800 bg-[#0f172a]/95 sticky top-0 z-50 backdrop-blur h-16 flex items-center px-4 md:px-8 justify-between">
              <div className="flex items-center gap-3">
                  <Layout className="w-8 h-8 text-indigo-500" />
                  <span className="text-xl font-black tracking-tighter uppercase hidden md:block">Cinematic Board</span>
                  <span className="text-xl font-black tracking-tighter uppercase md:hidden">StoryBoard</span>
              </div>
              
              <div className="flex gap-4 items-center">
                   {/* File Controls */}
                   <input type="file" ref={fileInputRef} className="hidden" accept=".zip" onChange={handleFileChange} />
                   <button onClick={handleImportClick} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 transition-colors" title="Import Project">
                      <Upload className="w-4 h-4" />
                   </button>
                   {storyData && (
                     <button onClick={handleExport} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 transition-colors" title="Export Project">
                        <Download className="w-4 h-4" />
                     </button>
                   )}

                   {/* Main Navigation */}
                   {storyData && (
                    <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700">
                      <button 
                        onClick={() => setActiveTab(Tab.INPUT)} 
                        className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-all ${activeTab === Tab.INPUT ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                        <Layers className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden md:inline">Story</span>
                      </button>
                      <button 
                        onClick={() => setActiveTab(Tab.ASSETS)} 
                        className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-all ${activeTab === Tab.ASSETS ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                        <Users className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden md:inline">Assets</span>
                      </button>
                      <button 
                        onClick={() => setActiveTab(Tab.STORYBOARD)} 
                        className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-all ${activeTab === Tab.STORYBOARD ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                        <Clapperboard className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden md:inline">Board</span>
                      </button>
                    </div>
                  )}
              </div>
          </nav>
          
          <main className="max-w-7xl mx-auto px-4 py-8">
            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-4 text-red-200">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <p>{error}</p>
              </div>
            )}

            {activeTab === Tab.INPUT && (
              <StoryInput 
                onAnalyze={handleAnalyzeStory} 
                status={status} 
                selectedVoice={selectedVoice} 
                onVoiceChange={setSelectedVoice} 
              />
            )}

            {activeTab === Tab.ASSETS && storyData && (
              <AssetGallery 
                characters={storyData.characters} 
                settings={storyData.settings} 
                onGenerateCharacter={handleGenerateCharacter} 
                onGenerateSetting={handleGenerateSetting} 
              />
            )}

            {activeTab === Tab.STORYBOARD && storyData && (
              <Storyboard 
                segments={storyData.segments} 
                onGenerateKeyframes={handleGenerateKeyframes}
                onGenerateVideo={handleGenerateVideo}
                onUpdateDuration={handleUpdateDuration}
                onPlayAudio={handleGenerateAndPlayAudio}
                onStopAudio={GeminiService.stopAudio}
              />
            )}
          </main>
        </>
      )}
    </div>
  );
}
