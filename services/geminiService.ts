
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { StoryData, AspectRatio, ImageSize } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_TEXT_ANALYSIS = 'gemini-3-pro-preview'; 
const MODEL_IMAGE_GEN = 'gemini-3-pro-image-preview'; 
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';
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
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['MAIN', 'BRANCH', 'MERGE_POINT'] },
            settingId: { type: Type.STRING },
            characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            combinedKeyframePrompt: { 
              type: Type.STRING, 
              description: "A highly detailed cinematic prompt for a 'Side by side' 4:3 image. MUST follow structure: 'Side by side shot. Left: [Detailed Close-up description]. Right: [Detailed Wide-shot description]. [Lighting/Atmosphere/Lens details]'. Use terminology like 'volumetric lighting', '85mm lens', 'bokeh', 'subsurface scattering'." 
            }
          },
          required: ["id", "text", "type", "settingId", "characterIds", "combinedKeyframePrompt"]
        }
      },
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { 
                type: Type.STRING,
                description: "Extremely detailed visual description for an AI image generator. Include: Age, Ethinicity, Skin Texture (pores, wrinkles, scars), Eye details, Specific Clothing fabrics (leather, silk, tattered cotton), Accessories, Body Language. Do not summarize personality, describe APPEARANCE." 
            }
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
            description: { 
                type: Type.STRING,
                description: "Extremely detailed environmental description. Include: Lighting sources (neon, candlelight, harsh sunlight), Atmosphere (dust motes, fog, rain), Textures (peeling paint, polished chrome, mossy stone), Time of Day, and Architectural style. Make it visceral." 
            }
          },
          required: ["id", "name", "description"]
        }
      }
    },
    required: ["title", "artStyle", "segments", "characters", "settings"]
  };

  const systemInstruction = `
  You are a world-class Cinematographer and Concept Artist (like Roger Deakins meeting Syd Mead). 
  Your goal is to break down a story into visual assets for a high-end film production.
  
  CRITICAL RULES FOR DESCRIPTIONS:
  1. **NO GENERIC ADJECTIVES**: Never use words like "scary", "beautiful", "sad". Instead describe the visual evidence: "shadows stretching like claws", "golden hour light hitting dust particles", "tears welling in bloodshot eyes".
  2. **MATERIALITY & TEXTURE**: Always specify materials. Not "a jacket", but "a distressed brown leather aviator jacket with brass zippers". Not "a wall", but "damp concrete walls with peeling industrial green paint".
  3. **LIGHTING IS KEY**: Every description must define the light. "Rim lighting", "Chiaroscuro", "Diffused softbox light", "Harsh fluorescent flicker".
  4. **CAMERA LANGUAGE**: Use terms like "Depth of field", "Bokeh", "Wide angle", "Telephoto compression".

  TASK:
  1. Analyze the story.
  2. Extract key Characters. Describe them as if writing a prompt for Midjourney/Flux.
  3. Extract key Settings. Describe them with intense atmosphere and detail.
  4. Break story into segments (beats). 
  5. For each segment, write a 'combinedKeyframePrompt' that creates a SPLIT SCREEN (Side-by-Side) composition.
     - LEFT SIDE: Intense Close-up (Face/Details).
     - RIGHT SIDE: Wide/Full Shot (Action/Environment).
     - Ensure the visual narrative evolves from left to right.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_TEXT_ANALYSIS,
    contents: `ANALYZE STORY:\n${storyText}\n\nDESIRED ART STYLE: ${artStyle}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      systemInstruction: systemInstruction,
      thinkingConfig: { thinkingBudget: 16000 } // Increased budget for deeper visual creativity
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateImage = async (prompt: string, aspectRatio: string = "4:3", size: string = "1K", refImages: string[] = []): Promise<string> => {
  const ai = getAi();
  const parts: any[] = [{ text: prompt }];
  
  refImages.forEach(img => {
    parts.push({ inlineData: { mimeType: 'image/png', data: img.split(',')[1] || img } });
  });

  const response = await ai.models.generateContent({
    model: MODEL_IMAGE_GEN,
    contents: { parts },
    config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: size as any } }
  });

  const data = response.candidates?.[0].content.parts.find((p: any) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("Image generation failed");
  return `data:image/png;base64,${data}`;
};

export const generateVideoBetweenFrames = async (prompt: string, startFrameB64: string, endFrameB64: string): Promise<{ url: string, videoObject: any }> => {
  const ai = getAi();
  let operation = await ai.models.generateVideos({
    model: MODEL_VIDEO_HD,
    prompt: prompt,
    image: {
      imageBytes: startFrameB64.split(',')[1] || startFrameB64,
      mimeType: 'image/png'
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '9:16',
      lastFrame: {
        imageBytes: endFrameB64.split(',')[1] || endFrameB64,
        mimeType: 'image/png'
      }
    }
  });

  while (!operation.done) {
    await new Promise(r => setTimeout(r, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videoMeta = operation.response?.generatedVideos?.[0]?.video;
  if (!videoMeta?.uri) throw new Error("Video render failed");

  const response = await fetch(`${videoMeta.uri}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), videoObject: videoMeta };
};

export const generateSpeech = async (text: string, voiceName: string): Promise<ArrayBuffer> => {
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
  if (!data) throw new Error("Speech failed");
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export const createWavBlob = (audioData: ArrayBuffer): Blob => {
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
  view.setUint32(24, 24000, true);
  view.setUint32(28, 48000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLen, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(audioData));
  return new Blob([buffer], { type: 'audio/wav' });
};
