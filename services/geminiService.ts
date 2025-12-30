import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { StoryData, AspectRatio, ImageSize, StructuredScene } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_TEXT_ANALYSIS = 'gemini-3-pro-preview'; 
const MODEL_IMAGE_GEN = 'gemini-3-pro-image-preview'; 
const MODEL_IMAGE_GEN_FALLBACK = 'gemini-2.5-flash-image'; 
const MODEL_IMAGE_EDIT = 'gemini-3-pro-image-preview'; 
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export const VOICES = [
  { name: 'Puck', gender: 'Male', style: 'Neutral & Clear' },
  { name: 'Charon', gender: 'Male', style: 'Deep & Grave' },
  { name: 'Kore', gender: 'Female', style: 'Soothing & Calm' },
  { name: 'Fenrir', gender: 'Male', style: 'Intense & Resonant' },
  { name: 'Zephyr', gender: 'Female', style: 'Bright & Energetic' },
  { name: 'Aoede', gender: 'Female', style: 'Confident & Professional' },
  { name: 'Iapetus', gender: 'Male', style: 'Deep & Steady' },
  { name: 'Umbriel', gender: 'Male', style: 'Resonant & Low' },
  { name: 'Algieba', gender: 'Male', style: 'Smooth & Deep' },
  { name: 'Despina', gender: 'Female', style: 'Warm & Smooth' },
  { name: 'Erinome', gender: 'Female', style: 'Clear & Balanced' },
  { name: 'Leda', gender: 'Female', style: 'Crisp & Open' }, 
  { name: 'Callirrhoe', gender: 'Female', style: 'Gentle & Soft' }
];

// Replaced AudioBufferSourceNode with HTMLAudioElement for consistency with Blob URLs
let currentAudio: HTMLAudioElement | null = null;

export const stopAudio = () => {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.onended = null; // Remove listeners
      currentAudio = null;
    } catch (e) {
      console.warn("Error stopping audio", e);
    }
  }
};

const CONTEXT_RULES = `
## THE "NO VACUUM" RULE (CONTEXT INFERENCE)
You are forbidden from generating generic, empty scenes. You must logically INFER the environment based on the narrative context.
`;

const PRESERVATION_RULES = `
## THE "ZERO DATA LOSS" PROTOCOL (CRITICAL)
1. **VERBATIM TEXT**: The \`text\` field of every segment MUST be an EXACT copy-paste of the original sentences.
`;

export const analyzeStoryText = async (storyText: string, artStyle: string): Promise<StoryData> => {
  const ai = getAi();
  
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      cinematicDNA: {
        type: Type.OBJECT,
        properties: {
          cameraSystem: { type: Type.STRING },
          colorPalette: { type: Type.STRING },
          lightingPhilosophy: { type: Type.STRING },
          filmStock: { type: Type.STRING },
          visualMood: { type: Type.STRING }
        },
        required: ["cameraSystem", "colorPalette", "lightingPhilosophy", "filmStock", "visualMood"]
      },
      visualStyleGuide: { type: Type.STRING },
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            photographicDescription: { type: Type.STRING },
            visualPrompt: { type: Type.STRING }
          },
          required: ["id", "name", "description", "photographicDescription", "visualPrompt"]
        }
      },
      settings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            floorPlan: { type: Type.STRING },
            visualPrompt: { type: Type.STRING }
          },
          required: ["id", "name", "description", "floorPlan", "visualPrompt"]
        }
      },
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            settingId: { type: Type.STRING },
            characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            quadrant: { type: Type.STRING },
            temporalLogic: { type: Type.STRING },
            timeOfDay: { type: Type.STRING },
            keyVisualAction: { type: Type.STRING },
            gridVariations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Generate 9 DISTINCT visual interpretations of the scene."
            },
            structuredScene: {
              type: Type.OBJECT,
              properties: {
                contextual_inference: { type: Type.STRING },
                subject_details: {
                  type: Type.OBJECT,
                  properties: {
                    appearance: { type: Type.STRING },
                    clothing: { type: Type.STRING },
                    expression: { type: Type.STRING }
                  },
                  required: ["appearance", "clothing", "expression"]
                },
                environment: {
                  type: Type.OBJECT,
                  properties: {
                    setting: { type: Type.STRING },
                    background_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
                    foreground_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
                    weather_and_atmosphere: { type: Type.STRING }
                  },
                  required: ["setting", "background_elements", "foreground_elements", "weather_and_atmosphere"]
                },
                lighting: {
                  type: Type.OBJECT,
                  properties: {
                    primary_source: { type: Type.STRING },
                    color_palette: { type: Type.STRING },
                    shadows: { type: Type.STRING }
                  },
                  required: ["primary_source", "color_palette", "shadows"]
                },
                camera: {
                  type: Type.OBJECT,
                  properties: {
                    shot_type: { type: Type.STRING },
                    angle: { type: Type.STRING },
                    lens_characteristics: { type: Type.STRING }
                  },
                  required: ["shot_type", "angle", "lens_characteristics"]
                }
              },
              required: ["contextual_inference", "subject_details", "environment", "lighting", "camera"]
            }
          },
          required: ["id", "text", "settingId", "characterIds", "quadrant", "temporalLogic", "timeOfDay", "keyVisualAction", "structuredScene", "gridVariations"]
        }
      }
    },
    required: ["title", "cinematicDNA", "visualStyleGuide", "characters", "settings", "segments"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_TEXT_ANALYSIS,
    contents: `
${PRESERVATION_RULES}
${CONTEXT_RULES}
Story: ${storyText}
Style: ${artStyle}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: 16384 },
      systemInstruction: `You are a forensic storyboard director. Split text into chunks (3-4 sentences max per chunk).`
    }
  });

  if (!response.text) throw new Error("No response from AI");
  const data = JSON.parse(response.text);

  data.segments = data.segments.map((seg: any) => {
     if (seg.grid_variations && !seg.gridVariations) seg.gridVariations = seg.grid_variations;
     if (seg.structuredScene) {
        const s = seg.structuredScene;
        const compiledPrompt = `
Shot: ${s.camera.shot_type}, ${s.camera.angle}.
Subject: ${s.subject_details.appearance}, ${s.subject_details.clothing}.
Action: ${s.subject_details.expression}.
Env: ${s.environment.setting}, ${s.environment.weather_and_atmosphere}.
        `.trim();
        return { ...seg, scenePrompt: compiledPrompt };
     }
     return seg;
  });

  return { ...data, artStyle };
};

export const generateImage = async (
  prompt: string, 
  aspectRatio: AspectRatio = AspectRatio.SQUARE, 
  imageSize: ImageSize = ImageSize.K1, 
  refImages?: string[],
  globalStyle?: string,
  cinematicDNA?: any,
  useGridMode: boolean = false,
  gridVariations?: string[]
): Promise<string> => {
  const ai = getAi();
  
  let safeAspectRatio = aspectRatio;
  if (aspectRatio === AspectRatio.CINEMATIC) safeAspectRatio = AspectRatio.WIDE;

  const systemInstruction = `You are a high-end visual director. ${useGridMode ? `Create a precision 3x3 grid. 9 Equal Panels. Same Character/Setting. 9 DIFFERENT ACTIONS.` : 'Create a single scene.'} ${globalStyle || ''}`;
  
  let gridText = "";
  if (useGridMode && gridVariations) {
     gridText = "Render 9 distinct panels based on these 9 actions:\n" + gridVariations.map((v, i) => `Panel ${i+1}: ${v}`).join('\n');
  }

  const parts: any[] = [{ text: `${prompt}\n${gridText}` }];
  if (refImages && refImages.length > 0) {
    refImages.forEach(base64Data => {
      const cleanBase64 = base64Data.split(',')[1] || base64Data;
      parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
    });
  }

  const imageConfig: any = { aspectRatio: safeAspectRatio };
  if (MODEL_IMAGE_GEN.includes('pro')) imageConfig.imageSize = imageSize;

  try {
      const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
        config: { imageConfig, systemInstruction }
      });
      return extractImageFromResponse(response);
  } catch (error: any) {
      // Fallback
      if (error.message?.includes('IMAGE_OTHER') || error.message?.includes('500')) {
         const fallbackResponse = await ai.models.generateContent({
            model: MODEL_IMAGE_GEN_FALLBACK,
            contents: { parts },
            config: { imageConfig: { aspectRatio: safeAspectRatio }, systemInstruction }
         });
         return extractImageFromResponse(fallbackResponse);
      }
      throw error;
  }
};

const extractImageFromResponse = (response: any): string => {
  const candidate = response.candidates?.[0];
  const part = candidate?.content?.parts?.find((p: any) => p.inlineData);
  if (part?.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
  throw new Error("No image generated.");
}

export const editImage = async (base64Image: string, instruction: string): Promise<string> => {
   const ai = getAi();
   const response = await ai.models.generateContent({
    model: MODEL_IMAGE_EDIT,
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: base64Image.split(',')[1] || base64Image } },
        { text: `Edit this image: ${instruction}` },
      ],
    },
  });
  return extractImageFromResponse(response);
};

export const generateSpeech = async (text: string, voiceName: string = 'Puck'): Promise<ArrayBuffer> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: MODEL_TTS,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Helper for writing string to DataView
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Creates a standard WAV Blob from PCM 16-bit 24kHz Mono data.
 * This is CRITICAL for browser compatibility (Chrome/Safari need headers).
 */
export const createWavBlob = (audioData: ArrayBuffer, sampleRate: number = 24000): Blob => {
  // Check if already WAV (RIFF header)
  if (audioData.byteLength >= 4) {
    const view = new DataView(audioData);
    // RIFF is 0x52494646 (Big Endian logic for string check)
    // But getUint32(0, false) reads Big Endian.
    if (view.getUint32(0, false) === 0x52494646) {
       return new Blob([audioData], { type: 'audio/wav' });
    }
  }

  const dataLen = audioData.byteLength;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8; // 2
  const byteRate = sampleRate * blockAlign; // 48000
  
  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLen, true);

  // Write PCM data
  const pcmBytes = new Uint8Array(audioData);
  const wavBytes = new Uint8Array(buffer, 44);
  wavBytes.set(pcmBytes);

  return new Blob([buffer], { type: 'audio/wav' });
};

export const playAudio = async (audioData: ArrayBuffer): Promise<void> => {
    stopAudio();
    
    // Create correct WAV blob for browser compatibility
    const blob = createWavBlob(audioData);
    const url = URL.createObjectURL(blob);
    
    const audio = new Audio(url);
    currentAudio = audio; // Track for stopping
    
    try {
        await audio.play();
    } catch (e) {
        console.error("Audio playback failed", e);
    }
};