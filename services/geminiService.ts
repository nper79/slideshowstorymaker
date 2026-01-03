
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
      visualStyleGuide: { type: Type.STRING, description: "Consistent guidelines for lighting, colors, and line work for a Manhwa." },
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING, description: "Visual description. ONLY include characters that appear multiple times or are central to the plot." }
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
            description: { type: Type.STRING, description: "Visual description. ONLY include recurring locations." }
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
            text: { type: Type.STRING, description: "The specific text chunk for this segment." },
            type: { type: Type.STRING, enum: ['MAIN', 'BRANCH', 'MERGE_POINT'] },
            choices: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING, description: "The choice text presented to the user." },
                        targetSegmentId: { type: Type.STRING, description: "The ID of the BRANCH segment this choice leads to." }
                    }
                }
            },
            nextSegmentId: { type: Type.STRING, description: "ID of the next segment (for linear flow or merging back)." },
            settingId: { type: Type.STRING },
            characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            scenePrompt: { type: Type.STRING, description: "General prompt for the 2x2 grid composition." },
            panels: { 
              type: Type.ARRAY, 
              items: {
                  type: Type.OBJECT,
                  properties: {
                      panelIndex: { type: Type.INTEGER },
                      visualPrompt: { type: Type.STRING, description: "Visual description for this specific beat." },
                      caption: { type: Type.STRING, description: "Text overlay. MUST BE EMPTY for silent beats." },
                      cameraAngle: { type: Type.STRING }
                  },
                  required: ["panelIndex", "visualPrompt", "caption", "cameraAngle"]
              },
              description: "Exactly 4 narrative beats. Use silent beats to build up to the text."
            }
          },
          required: ["id", "text", "type", "settingId", "characterIds", "scenePrompt", "panels"]
        }
      }
    },
    required: ["title", "artStyle", "segments", "characters", "settings"]
  };

  const systemInstruction = `
  You are an expert Director for Interactive Manhwa (Korean Webtoons).
  
  **GOAL**: Adapt the provided text into a visual, interactive storyboard with "Cosmetic Choices".

  ### 1. ASSET EXTRACTION
  - Identify the protagonists and key locations.
  - **CRITICAL**: Only create entries in 'characters' and 'settings' arrays if they are **RECURRING**. If a character appears once and never again, do not make a sheet for them.

  ### 2. INTERACTIVE STRUCTURE (The "Choices" Logic)
  - You must identify points in the story where the protagonist could make a choice.
  - Since the source text is linear, you must invent **Cosmetic Choices**:
    - Create a 'MAIN' segment that leads to a choice.
    - Create 2 'BRANCH' segments (Option A and Option B). These branches show different actions but do not change the overall plot.
    - Create a 'MERGE_POINT' segment where both branches rejoin the main story.
  - *Example*: Text says "She went to work." -> **Interactive Version**: Choice "How does she go?" -> Branch A: "Take the Bus" / Branch B: "Walk" -> Merge: "She arrived at work."

  ### 3. VISUAL PACING (The 4-Panel Rule)
  - Every segment represents ONE 9:16 vertical image split into a 2x2 grid (4 Panels).
  - **DECOUPLE TEXT FROM VISUALS**: 
    - Do NOT dump text into the first panel.
    - Use the 4 panels to build tension or atmosphere.
    - **SILENT BEATS**: You MUST use panels with empty captions ("") to show context, action, or emotion *before* the dialogue/narration appears.
  
  #### EXAMPLE OF PACING:
  *Source Text*: "I am a woman who lives alone."
  *Generated Panels*:
  - Panel 1: Close up of a digital clock changing numbers. Bip Bip. (Caption: "") [SILENT]
  - Panel 2: The main character sleeping in a messy bed. (Caption: "") [SILENT]
  - Panel 3: She opens her eyes groggily. (Caption: "") [SILENT]
  - Panel 4: She stands in front of the bathroom mirror, brushing teeth. (Caption: "I am a woman who lives alone.")

  ### 4. OUTPUT FORMAT
  - Ensure 'segments' form a linked list using 'nextSegmentId' and 'choices'.
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
  
  const configAspectRatio = aspectRatio;

  // Enhance style instruction for Manhwa
  let styleInstruction = `Style: ${globalStyle || 'Manhwa/Webtoon'}.`;
  if (globalStyle?.toLowerCase().includes('manhwa') || globalStyle?.toLowerCase().includes('manga')) {
      styleInstruction += " AESTHETIC: High-quality Korean Webtoon style. Cel-shaded, sharp lines, dramatic lighting, anime-influenced anatomy.";
  }

  const systemInstruction = `You are an expert concept artist. ${styleInstruction} 
  ${useGridMode ? 'FORMAT REQUIREMENT: 2x2 Split Screen Grid on a Vertical Canvas.' : ''}`;
  
  const promptParts = [`Visual prompt: ${prompt}`];
  
  if (useGridMode && gridVariations) {
    promptParts.push(`
STRICT LAYOUT: Create a 2x2 Grid (Manga/Manhwa Page) containing exactly 4 distinct panels.
- Structure: 2 columns by 2 rows.
- Composition: The entire final image must be a tall, vertical orientation (9:16 aspect ratio) containing the grid.
- STYLE CONSTRAINT: NO BORDERS. NO FRAMES. NO GUTTERS. The images should touch each other directly or merge seamlessly.
- SEQUENTIAL NARRATIVE (Left-to-Right, Top-to-Bottom):
  1. Top-Left Panel: ${gridVariations[0]}
  2. Top-Right Panel: ${gridVariations[1]}
  3. Bottom-Left Panel: ${gridVariations[2]}
  4. Bottom-Right Panel: ${gridVariations[3]}

- Consistency: Ensure characters and environment look consistent across all 4 panels as they tell a continuous story.
    `);
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
