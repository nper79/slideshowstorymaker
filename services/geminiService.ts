
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { StoryData, AspectRatio, ImageSize, ManhwaPanel } from "../types";

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

export const regeneratePanelPrompts = async (
    segmentText: string,
    fullStoryText: string,
    style: string,
    contextInfo: string
): Promise<ManhwaPanel[]> => {
    const ai = getAi();
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            panels: { 
                type: Type.ARRAY, 
                items: {
                    type: Type.OBJECT,
                    properties: {
                        panelIndex: { type: Type.INTEGER },
                        visualPrompt: { type: Type.STRING, description: "EXTREMELY DETAILED visual description. Include lighting, lens type, texture, background details, and specific character acting." },
                        caption: { type: Type.STRING, description: "Text overlay. Keep empty for silent beats." },
                        cameraAngle: { type: Type.STRING }
                    },
                    required: ["panelIndex", "visualPrompt", "caption", "cameraAngle"]
                },
                description: "Exactly 4 narrative beats."
            }
        },
        required: ["panels"]
    };

    const systemInstruction = `
    You are a Cinematographer and Art Director for a high-budget Manhwa.
    **TASK**: Rewrite the visual prompts for the specific **TARGET SEGMENT** provided below.
    
    **CRITICAL**: You have been provided with the **FULL STORY** for context. 
    - Read the FULL STORY to understand the emotional stakes, previous events, and character motivations leading up to this moment.
    - Ensure visual continuity with previous scenes implied by the story.
    - If the segment refers to "he" or "she", use the full story to identify exactly who they are and describe them consistent with previous descriptions.

    **STRICT RULES FOR VISUAL PROMPTS:**
    1. **NO LAZY DESCRIPTIONS**: Never write "Black screen with text" or "Character standing". 
       - BAD: "Black screen with text."
       - GOOD: "A void of absolute darkness. Faint, jagged scratch marks are visible in the texture. White serif text floats in the center, glowing slightly."
    2. **MAXIMIZE ATMOSPHERE**: Describe the lighting (volumetric, rim light, harsh shadows), the weather (rain streaks, dust motes), and the camera lens (macro, fish-eye, telephoto).
    3. **SHOW, DON'T TELL**: Instead of "He is sad", describe "Tears welling in the corners of eyes, lower lip trembling, heavy rain masking the crying."
    4. **4-PANEL FLOW**: Ensure the 4 panels create a mini-movie sequence.
    
    **SPECIFIC ASSET CONTEXT**:
    ${contextInfo}
    `;

    const response = await ai.models.generateContent({
        model: MODEL_TEXT_ANALYSIS,
        contents: `
FULL STORY CONTEXT:
"""
${fullStoryText}
"""

---

TARGET SEGMENT TO VISUALIZE (Break this specific text into 4 panels):
"""
${segmentText}
"""

ART STYLE: ${style}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: systemInstruction,
            thinkingConfig: { thinkingBudget: 4096 } // Moderate thinking for better creativity
        }
    });

    const result = JSON.parse(response.text || "{}");
    return result.panels || [];
};

export const analyzeStoryText = async (storyText: string, artStyle: string): Promise<StoryData> => {
  const ai = getAi();
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      artStyle: { type: Type.STRING },
      visualStyleGuide: { type: Type.STRING, description: "Detailed instructions for the AI artist. Include specific details on: Line Weight (e.g., thin, thick ink), Color Palette (e.g., pastel, neon, desaturated), Shading Style (e.g., Cel-shaded, Painterly), and Atmosphere." },
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING, description: "STRICT VISUAL ONLY. Do not describe personality. Describe: Hair color/style, Eye shape/color, Distinctive marks (scars, glasses), Clothing style (detailed), Colors." }
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
            description: { type: Type.STRING, description: "STRICT VISUAL ONLY. Architecture style, lighting, key props, colors." }
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
            scenePrompt: { type: Type.STRING, description: "General prompt for the 2x2 grid composition. Focus on action and atmosphere." },
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
  
  **GOAL**: Adapt the provided text into a visual, interactive storyboard while STRICTLY PRESERVING the original story text.

  ### 1. TEXT FIDELITY (CRITICAL)
  - You MUST use the **exact sentences** from the source text for the 'MAIN' segments. 
  - Do NOT summarize or rewrite the main story. Break it down verbatim into chunks.
  - You may write *new* text only for the 'BRANCH' segments (the cosmetic choices).

  ### 2. INTERACTIVE BRANCHING (Tension Only)
  - Identify moments of **HIGH TENSION** or **SUSPENSE** in the story to insert a choice.
  - Do NOT create choices for trivial actions (e.g., "Open door with left or right hand").
  - Create "Cosmetic Choices":
    - Choice A and Choice B should lead to slightly different visual sequences (BRANCH segments) but must **MERGE** back into the original story flow immediately after.
    - Example: "The killer is approaching!" -> Choice: "Hide under bed" vs "Hide in closet". Both branches show the hiding action, then merge back to "The killer entered the room" (Original text).

  ### 3. VISUAL PACING (The 4-Panel Rule)
  - Every segment represents ONE 9:16 vertical image split into a 2x2 grid (4 Panels).
  - **DECOUPLE TEXT FROM VISUALS**: 
    - The text for the segment usually appears in the 4th panel (the Result).
    - Use panels 1, 2, and 3 as **SILENT BEATS** (empty caption) to build atmosphere.
    - **Context -> Action -> Reaction -> Result (Text)**.
  
  #### EXAMPLE OF PACING:
  *Source Text*: "I heard a noise downstairs."
  *Generated Panels*:
  - Panel 1: Wide shot of the dark hallway. Shadows stretching. (Caption: "") [SILENT]
  - Panel 2: Close up of the character's ear twitching. (Caption: "") [SILENT]
  - Panel 3: Character's eyes widen in fear. (Caption: "") [SILENT]
  - Panel 4: Character looking towards the stairs. (Caption: "I heard a noise downstairs.")

  ### 4. OUTPUT FORMAT
  - Ensure 'segments' form a linked list using 'nextSegmentId'.
  - 'MAIN' segments flow into 'BRANCH' segments via 'choices'.
  - 'BRANCH' segments must flow into a 'MERGE_POINT' segment.
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
      styleInstruction += " AESTHETIC: High-quality Korean Webtoon style. Cel-shaded, sharp lines, dramatic lighting, anime-influenced anatomy. Vibrant colors.";
  }
  
  // Consistency Enforcement
  styleInstruction += " CONSISTENCY PROTOCOL: You must maintain the exact visual identity of the characters provided in the reference images. The character in the output MUST match the reference image's facial features, hair style, and clothing exactly.";

  const systemInstruction = `You are an expert concept artist. ${styleInstruction}`;
  
  const promptParts = [`Visual prompt: ${prompt}`];
  
  // Add style reference instruction if references are present
  if (refImages && refImages.length > 0) {
      promptParts.push("Style reference is attached.");
  }
  
  if (useGridMode && gridVariations) {
    promptParts.push(`
IMPORTANT LAYOUT REQUIREMENT: "NANO BANANA PRO" 2x2 GRID
- Create a single vertical image (9:16) that is perfectly divided into a 2x2 grid.
- **NO BORDERS, NO FRAMES, NO GUTTERS, NO WHITE SPACE.**
- The 4 images must touch each other directly (Seamless Full Bleed).
- Panel Order:
  1. Top-Left: ${gridVariations[0]}
  2. Top-Right: ${gridVariations[1]}
  3. Bottom-Left: ${gridVariations[2]}
  4. Bottom-Right: ${gridVariations[3]}
- **CONSISTENCY CHECK**: The same character MUST look identical in all 4 panels. Use the same model, clothing, and features.
    `);
  }

  const parts: any[] = [{ text: promptParts.join("\n") }];
  
  // Inject reference images if available
  if (refImages && refImages.length > 0) {
    refImages.forEach(b64 => {
      // Split base64 header if present
      const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
      parts.push({ 
          inlineData: { 
              mimeType: 'image/png', 
              data: base64Data 
          } 
      });
    });
    // Add text instruction to use references
    parts.push({ text: "REFERENCE IMAGES PROVIDED: Use the above images as the strict GROUND TRUTH for ART STYLE, character design, and setting details." });
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
