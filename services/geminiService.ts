import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { StoryData, AspectRatio, ImageSize, StructuredScene } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_TEXT_ANALYSIS = 'gemini-3-pro-preview'; 
const MODEL_IMAGE_GEN = 'gemini-3-pro-image-preview'; 
const MODEL_IMAGE_GEN_FALLBACK = 'gemini-2.5-flash-image'; 
const MODEL_IMAGE_EDIT = 'gemini-3-pro-image-preview'; 
// Corrected to the supported TTS model
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export const VOICES = [
  // Classic Voices (Verified supported)
  { name: 'Puck', gender: 'Male', style: 'Neutral & Clear' },
  { name: 'Charon', gender: 'Male', style: 'Deep & Grave' },
  { name: 'Kore', gender: 'Female', style: 'Soothing & Calm' },
  { name: 'Fenrir', gender: 'Male', style: 'Intense & Resonant' },
  { name: 'Zephyr', gender: 'Female', style: 'Bright & Energetic' },
  
  // New Native Audio Voices (Verified supported)
  { name: 'Aoede', gender: 'Female', style: 'Confident & Professional' },
  { name: 'Iapetus', gender: 'Male', style: 'Deep & Steady' },
  { name: 'Umbriel', gender: 'Male', style: 'Resonant & Low' },
  { name: 'Algieba', gender: 'Male', style: 'Smooth & Deep' },
  { name: 'Despina', gender: 'Female', style: 'Warm & Smooth' },
  { name: 'Erinome', gender: 'Female', style: 'Clear & Balanced' },
  // Replaced unsupported 'Himalia' with 'Leda'
  { name: 'Leda', gender: 'Female', style: 'Crisp & Open' }, 
  { name: 'Callirrhoe', gender: 'Female', style: 'Gentle & Soft' }
];

let currentSource: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;

export const stopAudio = () => {
  if (currentSource) {
    try {
      currentSource.stop();
      currentSource.disconnect();
    } catch (e) {
      console.warn("Error stopping audio", e);
    }
    currentSource = null;
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
            
            // GRID VARIATIONS FOR CONTACT SHEET
            gridVariations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Generate 9 DISTINCT visual interpretations of the scene. Do NOT just change the camera angle. You MUST change the ACTION, the MOMENT, or the INTERACTION. Example: If text is 'She is at home', Panel 1: Sleeping in bed, Panel 2: Eating breakfast, Panel 3: Reading on couch. Each panel must be a valid interpretation of the text segment."
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
# YOUR MISSION
You are a **Forensic Text Segmenter** and **Creative Visual Director**.
1. **SEGMENT**: Slice the story text into chunks.
2. **VISUALIZE**: Create the \`structuredScene\`.
3. **DIRECT (GRID)**: Create \`gridVariations\` (9 Panels).
   - **MANDATE**: You are brainstorming 9 different ways to visualize this segment.
   - **VARIETY**: Explore different ACTIONS and MOMENTS within the context of the text.
   - **EXAMPLE**: If text is "He waited in the lobby", do NOT just show 9 angles of him sitting. Show: 1. Checking watch. 2. Pacing. 3. Drinking coffee. 4. Looking out window. 5. Sleeping...
   - **FORMAT**: "Panel [1-9]: [Specific Action] in [Setting]. [Camera Detail]."

## STORY:
${storyText}
## STYLE:
${artStyle}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: 16384 },
      systemInstruction: `You are an automated transcription and visualization engine. 
      RULE 1: The 'text' property in the output MUST match the input text EXACTLY. 
      RULE 2: For 'gridVariations', generate 9 DISTINCT scenarios/actions that fit the text. Do not repeat the same pose 9 times.
      Style: ${artStyle}`
    }
  });

  if (!response.text) throw new Error("No response from AI");
  const data = JSON.parse(response.text);

  data.segments = data.segments.map((seg: any) => {
     // Safety: Map legacy snake_case to camelCase if returned
     if (seg.grid_variations && !seg.gridVariations) {
        seg.gridVariations = seg.grid_variations;
     }

     if (seg.structuredScene) {
        const s = seg.structuredScene;
        const compiledPrompt = `
(TECHNICAL SPECS)
Shot: ${s.camera.shot_type}, ${s.camera.angle}. Lens: ${s.camera.lens_characteristics}.
Lighting: ${s.lighting.primary_source}. Colors: ${s.lighting.color_palette}. Shadows: ${s.lighting.shadows}.

(SUBJECT)
Appearance: ${s.subject_details.appearance}.
Clothing: ${s.subject_details.clothing}.
Expression: ${s.subject_details.expression}.

(ENVIRONMENT & ATMOSPHERE)
Setting: ${s.environment.setting}.
Foreground: ${s.environment.foreground_elements.join(', ')}.
Background: ${s.environment.background_elements.join(', ')}.
Atmosphere: ${s.environment.weather_and_atmosphere}.

(CONTEXT & LOGIC)
${s.contextual_inference}
        `.trim();
        return { ...seg, scenePrompt: compiledPrompt };
     }
     return seg;
  });

  return { ...data, artStyle };
};

// ============================================
// IMPROVED IMAGE GENERATION (GRID MODE WITH MULTI-PROMPT)
// ============================================

export const generateImage = async (
  prompt: string, 
  aspectRatio: AspectRatio = AspectRatio.SQUARE, 
  imageSize: ImageSize = ImageSize.K1,
  refImages?: string[],
  globalStyle?: string,
  cinematicDNA?: any,
  useGridMode: boolean = false,
  gridVariations?: string[] // ARRAY OF 9 PROMPTS
): Promise<string> => {
  const ai = getAi();
  
  let safeAspectRatio = aspectRatio;
  if (aspectRatio === AspectRatio.CINEMATIC) {
      safeAspectRatio = AspectRatio.WIDE;
  }

  // Determine the shape description for the prompt based on the requested aspect ratio
  let panelShapeDescription = "Square (1:1)";
  if (aspectRatio === AspectRatio.MOBILE) {
      panelShapeDescription = "Vertical Portrait (9:16)";
  } else if (aspectRatio === AspectRatio.WIDE || aspectRatio === AspectRatio.CINEMATIC) {
      panelShapeDescription = "Widescreen (16:9)";
  } else if (aspectRatio === AspectRatio.PORTRAIT) {
      panelShapeDescription = "Vertical (3:4)";
  } else if (aspectRatio === AspectRatio.LANDSCAPE) {
      panelShapeDescription = "Landscape (4:3)";
  }

  const dnaPrompt = cinematicDNA ? `
    **GLOBAL CINEMATIC DNA:**
    Camera: ${cinematicDNA.cameraSystem}
    Palette: ${cinematicDNA.colorPalette}
    Mood: ${cinematicDNA.visualMood}
  ` : '';

  let gridInstructions = "";
  let panelPrompts = "";

  if (useGridMode) {
      gridInstructions = `
      **STRICT 3x3 GRID LAYOUT INSTRUCTION:**
      - Generate a SINGLE image divided exactly into a 3x3 grid (9 equal rectangles).
      - **GEOMETRY**: All 9 rectangles must have exactly the same width and height.
      - **PANEL ASPECT RATIO**: Each individual grid cell must be **${panelShapeDescription}**. Do not distort the aspect ratio.
      - **CONTENT**: This is a VARIATION BOARD for the scene.
      - **CONSISTENCY**: The CHARACTER IDENTITY (Face, Clothes, Body) and general SETTING must remain consistent.
      - **VARIATION**: The ACTION, POSE, and INTERACTION must change in every panel as described below.
      `;

      if (gridVariations && gridVariations.length > 0) {
         // Construct the per-panel instructions mapped to grid positions
         panelPrompts = `
         **PANEL EXECUTION PLAN (9 DISTINCT ACTIONS):**
         
         [ROW 1 - TOP]
         - Top-Left (Panel 1): ${gridVariations[0]}
         - Top-Center (Panel 2): ${gridVariations[1]}
         - Top-Right (Panel 3): ${gridVariations[2]}

         [ROW 2 - MIDDLE]
         - Mid-Left (Panel 4): ${gridVariations[3]}
         - Center (Panel 5): ${gridVariations[4]}
         - Mid-Right (Panel 6): ${gridVariations[5]}

         [ROW 3 - BOTTOM]
         - Bottom-Left (Panel 7): ${gridVariations[6]}
         - Bottom-Center (Panel 8): ${gridVariations[7]}
         - Bottom-Right (Panel 9): ${gridVariations[8]}
         `;
      } else {
         panelPrompts = `
         Panel 1: Action A.
         Panel 2: Action B.
         Panel 3: Action C.
         Panel 4: Action D.
         Panel 5: Action E.
         Panel 6: Action F.
         Panel 7: Action G.
         Panel 8: Action H.
         Panel 9: Action I.
         `;
      }
  }

  const finalPrompt = `
${dnaPrompt}
${gridInstructions}

**SCENE TRUTH (APPLIES TO ALL PANELS):**
${prompt}

${panelPrompts}

**RENDER INSTRUCTIONS:**
- Photorealistic, cinematic 8K render.
- High dynamic range.
- NO cartoons (unless style specified).
- NO empty spaces.
- **Visual Consistency**: The character identity and setting must remain constant across all 9 panels.

**CONSISTENCY PROTOCOL:**
- IF Reference Images are provided:
   - IMAGE 1 (if present) is the MASTER CHARACTER ASSET.
   - IMAGE 2 (if present) is the SETTING ASSET.
`;

  const parts: any[] = [{ text: finalPrompt }];
  
  if (refImages && refImages.length > 0) {
    refImages.forEach(base64Data => {
      const cleanBase64 = base64Data.split(',')[1] || base64Data;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: cleanBase64
        }
      });
    });
  }

  const imageConfig: any = {
    aspectRatio: safeAspectRatio,
    // We only want 1 image returned (the contact sheet)
    numberOfImages: 1 
  };
  
  if (MODEL_IMAGE_GEN.includes('pro')) {
      imageConfig.imageSize = imageSize;
  }
  
  const systemInstruction = `You are a high-end visual director. ${useGridMode ? `Create a precision 3x3 grid. 9 Equal Panels. Each panel is ${panelShapeDescription}. Same Character/Setting. 9 DIFFERENT ACTIONS/MOMENTS.` : 'Create a single scene.'} ${globalStyle || ''}`;

  try {
      const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
        config: { 
          imageConfig,
          systemInstruction
        }
      });
      return extractImageFromResponse(response);

  } catch (error: any) {
      // Fallback Logic
      const isGenerationError = error.message?.includes('IMAGE_OTHER') || 
                                error.toString().includes('IMAGE_OTHER') ||
                                error.message?.includes('500') ||
                                error.message?.includes('503');

      if (isGenerationError) {
         console.warn(`Primary model failed. Falling back to ${MODEL_IMAGE_GEN_FALLBACK}.`);
         
         const fallbackConfig = {
            aspectRatio: safeAspectRatio,
            numberOfImages: 1
         };
         
         try {
             const fallbackResponse = await ai.models.generateContent({
                model: MODEL_IMAGE_GEN_FALLBACK,
                contents: { parts },
                config: {
                    imageConfig: fallbackConfig,
                    systemInstruction
                }
             });
             return extractImageFromResponse(fallbackResponse);
         } catch (fallbackError: any) {
             throw new Error(`Both models failed. ${fallbackError.message}`);
         }
      }
      throw error;
  }
};

const extractImageFromResponse = (response: any): string => {
  if (!response.candidates || response.candidates.length === 0) {
     throw new Error("AI returned no candidates.");
  }
  const candidate = response.candidates[0];
  const part = candidate.content?.parts?.find((p: any) => p.inlineData);
  if (part && part.inlineData && part.inlineData.data) {
    return `data:image/png;base64,${part.inlineData.data}`;
  }
  const textPart = candidate.content?.parts?.find((p: any) => p.text);
  if (textPart && textPart.text) {
      const msg = textPart.text.length > 150 ? textPart.text.substring(0, 150) + "..." : textPart.text;
      throw new Error(`AI Refused: ${msg}`);
  }
  throw new Error("No image generated.");
}

export const editImage = async (base64Image: string, instruction: string): Promise<string> => {
   const ai = getAi();
   const cleanBase64 = base64Image.split(',')[1] || base64Image;
   
   const response = await ai.models.generateContent({
    model: MODEL_IMAGE_EDIT,
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
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
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName }, 
        },
      },
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
 * Wraps raw PCM data in a WAV file container so browsers can play it via Blob URL.
 */
export const createWavBlob = (audioData: ArrayBuffer, sampleRate: number = 24000): Blob => {
  const buffer = new ArrayBuffer(44 + audioData.byteLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + audioData.byteLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate (SampleRate * BlockAlign)
  view.setUint16(32, 2, true); // Block align (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // Bits per sample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, audioData.byteLength, true);

  // Write audio data
  const audioView = new Uint8Array(audioData);
  const wavView = new Uint8Array(buffer, 44);
  wavView.set(audioView);

  return new Blob([buffer], { type: 'audio/wav' });
};

export const playAudio = async (audioData: ArrayBuffer): Promise<void> => {
    stopAudio();
    const sampleRate = 24000;
    
    // 1. Create Context if missing
    if (!audioContext) {
         audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
    }

    // 2. CRITICAL FIX: Ensure context is running. Browsers suspend it by default.
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (e) {
            console.error("Failed to resume audio context", e);
        }
    }

    // 3. Safer buffer view creation (handling potential odd-byte lengths)
    // Make sure we have an even number of bytes for Int16Array
    const dataLen = audioData.byteLength;
    const safeLen = dataLen % 2 === 0 ? dataLen : dataLen - 1;
    const dataInt16 = new Int16Array(audioData.slice(0, safeLen));

    const numChannels = 1;
    const frameCount = dataInt16.length / numChannels;
    const audioBuffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    currentSource = source;
    return new Promise((resolve) => {
        source.onended = () => { resolve(); };
        source.start(0);
    });
};