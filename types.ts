
export enum ProcessingStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export interface Setting {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export enum SegmentType {
  MAIN = 'MAIN',
  BRANCH = 'BRANCH',
  MERGE_POINT = 'MERGE_POINT'
}

export interface StorySegment {
  id: string;
  text: string;
  settingId: string;
  characterIds: string[];
  type: SegmentType;
  
  // Split Keyframe Logic
  combinedKeyframePrompt: string; // Instrução para gerar os 2 frames lado a lado
  combinedKeyframeUrl?: string;   // Imagem 1x1 original
  startFrameUrl?: string;         // Fatia Esquerda
  endFrameUrl?: string;           // Fatia Direita
  
  isGeneratingKeyframes?: boolean;
  isVideoGenerating?: boolean;
  
  // Video & Audio
  videoUrl?: string;
  videoObject?: any;
  audioUrl?: string;
  audioDuration?: number;
  
  choices?: { text: string; targetSegmentId: string; }[];
  isGenerating?: boolean; // Para áudio/outros

  // Additional fields for compatibility
  generatedImageUrls?: string[];
  masterGridImageUrl?: string;
  selectedGridIndices?: number[];
  scenePrompt?: string;
  gridVariations?: boolean;
  generatedImageUrl?: string;
  imageOptions?: any;
}

export interface StoryData {
  title: string;
  artStyle: string;
  visualStyleGuide?: string;
  cinematicDNA?: any;
  segments: StorySegment[];
  characters: Character[];
  settings: Setting[];
}

export enum AspectRatio { MOBILE = "9:16", LANDSCAPE = "16:9", PORTRAIT = "3:4", STANDARD = "4:3" }
export enum ImageSize { K1 = "1K", K2 = "2K" }