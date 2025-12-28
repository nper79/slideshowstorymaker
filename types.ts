export enum ProcessingStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING_ASSETS = 'GENERATING_ASSETS',
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface Character {
  id: string;
  name: string;
  description: string;
  visualPrompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export interface Setting {
  id: string;
  name: string;
  description: string;
  visualPrompt: string; // Top down view prompt
  imageUrl?: string;
  isGenerating?: boolean;
}

export interface CinematicDNA {
  cameraSystem: string;
  colorPalette: string;
  lightingPhilosophy: string;
  filmStock: string;
  visualMood: string;
}

// New High-Density Structure
export interface StructuredScene {
  subject_details: {
    appearance: string;
    clothing: string;
    expression: string;
  };
  environment: {
    setting: string;
    background_elements: string[];
    foreground_elements: string[];
    weather_and_atmosphere: string;
  };
  lighting: {
    primary_source: string;
    color_palette: string;
    shadows: string;
  };
  camera: {
    shot_type: string;
    angle: string;
    lens_characteristics: string;
  };
  contextual_inference: string; // Why are these details here?
}

export interface StorySegment {
  id: string;
  text: string;
  settingId: string;
  characterIds: string[];
  quadrant: string; // e.g., "top-left", "center"
  temporalLogic: string; 
  timeOfDay: string; 
  keyVisualAction: string; 
  
  // This will be the compiled string for the Image Generator/UI
  scenePrompt: string; 
  
  // This stores the granular raw data
  structuredScene?: StructuredScene;

  generatedImageUrl?: string;
  isGenerating?: boolean;
}

export interface StoryData {
  title: string;
  artStyle: string;
  visualStyleGuide: string; 
  cinematicDNA: CinematicDNA; 
  segments: StorySegment[];
  characters: Character[];
  settings: Setting[];
}

export enum AspectRatio {
  SQUARE = "1:1",
  PORTRAIT = "3:4",
  LANDSCAPE = "4:3",
  WIDE = "16:9",
  MOBILE = "9:16",
  CINEMATIC = "21:9"
}

export enum ImageSize {
  K1 = "1K",
  K2 = "2K",
  K4 = "4K"
}