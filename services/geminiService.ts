import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { StoryData, AspectRatio, ImageSize, StructuredScene, VideoClipPrompt, SegmentType } from "../types";

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

const BIFURCATION_STRICT_RULES = `
## THE VERBATIM BACKBONE PROTOCOL (CRITICAL)
1. **ABSOLUTELY NO SUMMARIZATION**: You are FORBIDDEN from rewriting, shortening, or changing the author's words in 'MAIN' segments. 
2. **VERBATIM CHUNKING**: Take the user's story and copy-paste it EXACTLY into 'MAIN' segments. Each segment should contain a block of 3 to 4 original sentences.
3. **BIFURCATION**: Insert Choice Points between some MAIN segments. 
4. **BRANCHES**: 'BRANCH' segments are the ONLY segments where you can write your own text to react to a choice.
5. **MERGE**: Every BRANCH must eventually link back to the next sequential MAIN segment from the original story text.
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
            visualPrompt: { type: Type.STRING }
          },
          required: ["id", "name", "description", "visualPrompt"]
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
            visualPrompt: { type: Type.STRING }
          },
          required: ["id", "name", "description", "visualPrompt"]
        }
      },
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['MAIN', 'BRANCH', 'MERGE_POINT'] },
            parentId: { type: Type.STRING },
            settingId: { type: Type.STRING },
            characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            choices: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  targetSegmentId: { type: Type.STRING }
                },
                required: ["text", "targetSegmentId"]
              }
            },
            nextSegmentId: { type: Type.STRING },
            quadrant: { type: Type.STRING },
            timeOfDay: { type: Type.STRING },
            keyVisualAction: { type: Type.STRING },
            gridVariations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "MANDATORY: Provide exactly 9 distinct action descriptions for a 3x3 grid."
            }
          },
          required: ["id", "text", "type", "settingId", "characterIds", "quadrant", "timeOfDay", "keyVisualAction", "gridVariations"]
        }
      }
    },
    required: ["title", "cinematicDNA", "visualStyleGuide", "characters", "settings", "segments"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_TEXT_ANALYSIS,
    contents: `USER STORY: ${storyText}\nART STYLE: ${artStyle}\n\n${BIFURCATION_STRICT_RULES}\nChunk the story into 9-variation segments.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: 16384 },
      systemInstruction: `You are a script supervisor. Copy story text VERBATIM for MAIN segments.`
    }
  });

  if (!response.text) throw new Error("No response from AI");
  const data = JSON.parse(response.text);

  data.segments = data.segments.map((seg: any) => ({
    ...seg,
    scenePrompt: `Cinematic scene: ${seg.keyVisualAction}. Style: ${artStyle}`
  }));

  return { ...data, artStyle };
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
  const safeAspectRatio = AspectRatio.MOBILE; // Always 9:16

  const systemInstruction = `You are a professional visual director. ${useGridMode ? 'MANDATORY: Create a SEAMLESS 3x3 grid containing exactly 9 vertical (9:16) frames. ABSOLUTELY NO BORDERS, NO GRID LINES, NO WHITE SPACE. The images MUST touch each other edge-to-edge. Each of the 9 cells must be a full 9:16 vertical composition.' : 'Create a single 9:16 vertical scene.'} Style: ${globalStyle || ''}`;
  
  let gridText = "";
  if (useGridMode && gridVariations) {
     gridText = "MANDATORY: Create a 3x3 seamless contact sheet (9 frames total) for these actions:\n" + gridVariations.slice(0, 9).map((v, i) => `Frame ${i+1}: ${v}`).join('\n');
  }

  const parts: any[] = [{ text: `${prompt}\n${gridText}` }];
  if (refImages && refImages.length > 0) {
    refImages.forEach(base64Data => {
      parts.push({ inlineData: { mimeType: 'image/png', data: base64Data.split(',')[1] || base64Data } });
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
      const fallbackResponse = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN_FALLBACK,
        contents: { parts },
        config: { imageConfig: { aspectRatio: safeAspectRatio }, systemInstruction }
      });
      return extractImageFromResponse(fallbackResponse);
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
        { text: `Edit this 9:16 vertical image: ${instruction}` },
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
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
};

export const createWavBlob = (audioData: ArrayBuffer, sampleRate: number = 24000): Blob => {
  if (audioData.byteLength >= 4) {
    const view = new DataView(audioData);
    if (view.getUint32(0, false) === 0x52494646) return new Blob([audioData], { type: 'audio/wav' });
  }
  const dataLen = audioData.byteLength;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = 2;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLen, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(audioData));
  return new Blob([buffer], { type: 'audio/wav' });
};

export const playAudio = async (audioData: ArrayBuffer): Promise<void> => {
    stopAudio();
    const url = URL.createObjectURL(createWavBlob(audioData));
    currentAudio = new Audio(url);
    try { await currentAudio.play(); } catch (e) {}
};

export const planVideoSequence = async (
    segmentText: string,
    totalDuration: number,
    selectedIndices: number[],
    gridDescriptions: string[]
): Promise<VideoClipPrompt[]> => {
    const ai = getAi();
    const schema: Schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                frameIndex: { type: Type.INTEGER },
                duration: { type: Type.NUMBER },
                type: { type: Type.STRING, enum: ['ACTION', 'LOOP_BUFFER'] },
                prompt: { type: Type.STRING },
                reasoning: { type: Type.STRING }
            },
            required: ['frameIndex', 'duration', 'type', 'prompt', 'reasoning']
        }
    };
    const response = await ai.models.generateContent({
        model: MODEL_TEXT_ANALYSIS,
        contents: `Audio Duration: ${totalDuration.toFixed(3)}s. Selected: ${JSON.stringify(selectedIndices)}. Descriptions: ${JSON.stringify(gridDescriptions)}. Create plan.`,
        config: { responseMimeType: "application/json", responseSchema: schema }
    });
    if (!response.text) throw new Error("Failed to plan video");
    return JSON.parse(response.text) as VideoClipPrompt[];
}
