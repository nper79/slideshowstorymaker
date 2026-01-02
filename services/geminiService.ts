
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { StoryData, AspectRatio, ImageSize } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_TEXT_ANALYSIS = 'gemini-3-pro-preview'; 
const MODEL_IMAGE_GEN = 'gemini-3-pro-image-preview'; 
const MODEL_IMAGE_GEN_FALLBACK = 'gemini-2.5-flash-image'; 
const MODEL_IMAGE_EDIT = 'gemini-3-pro-image-preview'; 
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';
const MODEL_VIDEO_FAST = 'veo-3.1-fast-generate-preview';
const MODEL_VIDEO_HD = 'veo-3.1-generate-preview';

export const VOICES = [
  { name: 'Puck', gender: 'Male', style: 'Neutral & Clear' },
  { name: 'Charon', gender: 'Male', style: 'Deep & Grave' },
  { name: 'Kore', gender: 'Female', style: 'Soothing & Calm' },
  { name: 'Fenrir', gender: 'Male', style: 'Intense & Resonant' },
  { name: 'Zephyr', gender: 'Female', style: 'Bright & Energetic' },
  { name: 'Aoede', gender: 'Female', style: 'Confident & Professional' }
];

let currentAudio: HTMLAudioElement | null = null;

export const stopAudio = () => {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.onended = null;
      currentAudio = null;
    } catch (e) {
      console.warn("Error stopping audio", e);
    }
  }
};

export const playAudio = async (audioData: ArrayBuffer): Promise<void> => {
  stopAudio();
  const blob = createWavBlob(audioData);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  return new Promise((resolve) => {
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.play();
  });
};

export const analyzeStoryText = async (storyText: string, artStyle: string): Promise<StoryData> => {
  const ai = getAi();
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      artStyle: { type: Type.STRING },
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING, description: "Visual description (appearance, clothes, face)." }
          },
          required: ["id", "name", "description"]
        }
      },
      settings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING, description: "Visual description of the location/environment." }
          },
          required: ["id", "name", "description"]
        }
      },
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING, description: "Original text segment (3-4 sentences)." },
            type: { type: Type.STRING, enum: ['MAIN', 'BRANCH', 'MERGE_POINT'] },
            settingId: { type: Type.STRING },
            characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            scenePrompt: { type: Type.STRING, description: "Detailed visual prompt for this specific moment." },
            gridVariations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "A list of 9 distinct cinematic variations (angles, framings) for this scene to generate a 3x3 grid."
            }
          },
          required: ["id", "text", "type", "settingId", "characterIds", "scenePrompt", "gridVariations"]
        }
      }
    },
    required: ["title", "artStyle", "segments", "characters", "settings"]
  };

  const systemInstruction = `
  You are a Cinematic Storyboard Assistant and Director.
  
  Your goal is to break the story into small segments (3-4 sentences max) and plan the visual assets.
  
  CRITICAL: For each segment, you must act as a Director and plan 9 distinct camera shots (Grid Variations) that capture the essence of that specific moment.
  
  For 'gridVariations', provide exactly 9 strings describing different angles, for example:
  1. Wide establishing shot
  2. Over-the-shoulder shot of character A
  3. Extreme close-up on eyes
  4. Low angle looking up (hero shot)
  5. Dutch angle (tension)
  6. Handheld camera movement
  7. Top-down view
  8. Rack focus on object
  9. Silhouette against light
  
  Ensure the variations match the emotional tone of the text segment.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_TEXT_ANALYSIS,
    contents: `FULL RAW TEXT:\n${storyText}\n\nSTYLE: ${artStyle}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      systemInstruction: systemInstruction,
      thinkingConfig: { thinkingBudget: 8192 }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateImage = async (
  prompt: string, 
  aspectRatio: AspectRatio = AspectRatio.MOBILE, 
  imageSize: ImageSize = ImageSize.K1, 
  refImages?: string[],
  globalStyle?: string,
  cinematicDNA?: any,
  useGridMode: boolean = false,
  gridVariations?: string[]
): Promise<string> => {
  const ai = getAi();
  
  // Force MOBILE aspect ratio for grid generation to ensure high vertical resolution
  const configAspectRatio = useGridMode ? AspectRatio.MOBILE : aspectRatio;

  const systemInstruction = `You are an expert concept artist. Style: ${globalStyle || 'Cinematic'}. ${useGridMode ? 'Format: 3x3 High Precision Contact Sheet.' : ''}`;
  
  const promptParts = [`Visual prompt: ${prompt}`];
  
  if (useGridMode && gridVariations) {
    promptParts.push(`Create a 3x3 grid layout (contact sheet) showing 9 variations of this scene:\n${gridVariations.map((v, i) => `${i+1}. ${v}`).join('\n')}`);
  }

  const parts: any[] = [{ text: promptParts.join("\n") }];
  
  if (refImages && refImages.length > 0) {
    refImages.forEach(b64 => {
      parts.push({ inlineData: { mimeType: 'image/png', data: b64.split(',')[1] || b64 } });
    });
  }

  try {
      const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
        config: { imageConfig: { aspectRatio: configAspectRatio, imageSize }, systemInstruction }
      });
      const data = response.candidates?.[0].content.parts.find((p: any) => p.inlineData)?.inlineData?.data;
      if (!data) throw new Error("No image data");
      return `data:image/png;base64,${data}`;
  } catch (error: any) {
      const fallbackResponse = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN_FALLBACK,
        contents: { parts },
        config: { imageConfig: { aspectRatio: configAspectRatio }, systemInstruction }
      });
      const data = fallbackResponse.candidates?.[0].content.parts.find((p: any) => p.inlineData)?.inlineData?.data;
      if (!data) throw new Error("Image gen failed");
      return `data:image/png;base64,${data}`;
  }
};

export const editImage = async (base64Image: string, instruction: string): Promise<string> => {
  const ai = getAi();
  const parts = [
    { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType: 'image/png' } },
    { text: instruction }
  ];

  const response = await ai.models.generateContent({
    model: MODEL_IMAGE_EDIT,
    contents: { parts },
  });

  const data = response.candidates?.[0].content.parts.find((p: any) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("Image edit failed");
  return `data:image/png;base64,${data}`;
};

export const generateInitialVideo = async (prompt: string, imageBase64: string): Promise<{ url: string, videoObject: any }> => {
  const ai = getAi();
  let operation = await ai.models.generateVideos({
    model: MODEL_VIDEO_FAST,
    prompt: prompt,
    image: { imageBytes: imageBase64.split(',')[1] || imageBase64, mimeType: 'image/png' },
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' }
  });

  while (!operation.done) {
    await new Promise(r => setTimeout(r, 8000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videoMeta = operation.response?.generatedVideos?.[0]?.video;
  if (!videoMeta?.uri) throw new Error("Video generation failed");

  const response = await fetch(`${videoMeta.uri}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), videoObject: videoMeta };
};

export const extendVideo = async (prompt: string, previousVideoObject: any): Promise<{ url: string, videoObject: any }> => {
  const ai = getAi();
  let operation = await ai.models.generateVideos({
    model: MODEL_VIDEO_HD,
    prompt: prompt,
    video: previousVideoObject,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' }
  });

  while (!operation.done) {
    await new Promise(r => setTimeout(r, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videoMeta = operation.response?.generatedVideos?.[0]?.video;
  if (!videoMeta?.uri) throw new Error("Extension failed");

  const response = await fetch(`${videoMeta.uri}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), videoObject: videoMeta };
};

export const generateSpeech = async (text: string, voiceName: string = 'Puck'): Promise<ArrayBuffer> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: MODEL_TTS,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });
  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error("Speech synthesis failed");
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export const createWavBlob = (audioData: ArrayBuffer, sampleRate: number = 24000): Blob => {
  const dataLen = audioData.byteLength;
  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);
  const writeString = (v: DataView, o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLen, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(audioData));
  return new Blob([buffer], { type: 'audio/wav' });
};
