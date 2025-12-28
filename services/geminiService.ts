import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { StoryData, AspectRatio, ImageSize, StructuredScene } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_TEXT_ANALYSIS = 'gemini-3-pro-preview'; 
const MODEL_IMAGE_GEN = 'gemini-3-pro-image-preview'; 
const MODEL_IMAGE_GEN_FALLBACK = 'gemini-2.5-flash-image'; // Fallback model
const MODEL_IMAGE_EDIT = 'gemini-3-pro-image-preview'; 
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export const VOICES = [
  { name: 'Puck', gender: 'Male', style: 'Neutral & Clear' },
  { name: 'Charon', gender: 'Male', style: 'Deep & Grave' },
  { name: 'Kore', gender: 'Female', style: 'Soothing & Calm' },
  { name: 'Fenrir', gender: 'Male', style: 'Intense & Resonant' },
  { name: 'Zephyr', gender: 'Female', style: 'Bright & Energetic' },
];

// ============================================
// AUDIO CONTROL
// ============================================

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

// ============================================
// LOGIC & INFERENCE ENGINE
// ============================================

const CONTEXT_RULES = `
## THE "NO VACUUM" RULE (CONTEXT INFERENCE)
You are forbidden from generating generic, empty scenes. You must logically INFER the environment based on the narrative context.

**Examples of Logical Inference:**
- *Text:* "I went to work." 
  -> *Inference:* It is morning. There is traffic. There are other pedestrians. The sun is low. There is coffee steam.
- *Text:* "I heard a noise in the alley." 
  -> *Inference:* It is dirty. There are trash bags. There are stray cats. There is graffiti. Puddles reflect the weak light.
- *Text:* "I sat on the couch."
  -> *Inference:* Is the TV on? Is there a remote? Are there snacks? Is the room messy or clean? 

## MASTERPIECE JSON STRUCTURE
You must break down every single frame into granular details. Do not write paragraphs. Write data.
`;

const PRESERVATION_RULES = `
## THE "ZERO DATA LOSS" PROTOCOL (CRITICAL)
1. **VERBATIM TEXT**: The \`text\` field of every segment MUST be an EXACT copy-paste of the original sentences.
   - ❌ BAD: "She went to work." (Summarized)
   - ✅ GOOD: "Every morning, I usually walk to work because it’s less than two kilometers from the place I rent." (Exact)
2. **NO SKIPPING**: You must include every single sentence. Do not skip the "boring" parts.
3. **GRANULARITY**: Break the text every 2-4 sentences.
4. **INTEGRITY CHECK**: If I join all your \`text\` fields together, it MUST match the original story exactly.
`;

// ============================================
// IMPROVED STORY ANALYSIS
// ============================================

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
            text: { 
              type: Type.STRING,
              description: "CRITICAL: The EXACT, VERBATIM sentences from the source text. DO NOT EDIT. DO NOT SUMMARIZE." 
            },
            settingId: { type: Type.STRING },
            characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            quadrant: { type: Type.STRING },
            temporalLogic: { type: Type.STRING },
            timeOfDay: { type: Type.STRING },
            keyVisualAction: { type: Type.STRING },
            
            // THE NEW MASTERPIECE STRUCTURE
            structuredScene: {
              type: Type.OBJECT,
              properties: {
                contextual_inference: { 
                  type: Type.STRING,
                  description: "EXPLAIN WHY you added details. E.g., 'Since she is rushing, I added motion blur and disheveled hair.'"
                },
                subject_details: {
                  type: Type.OBJECT,
                  properties: {
                    appearance: { type: Type.STRING, description: "Hair style, texture, skin details, sweat, imperfections." },
                    clothing: { type: Type.STRING, description: "Fabric texture, specific garments, fit, wear and tear." },
                    expression: { type: Type.STRING, description: "Micro-expression, eye focus, lip tension." }
                  },
                  required: ["appearance", "clothing", "expression"]
                },
                environment: {
                  type: Type.OBJECT,
                  properties: {
                    setting: { type: Type.STRING },
                    background_elements: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING },
                      description: "List 4-5 specific objects creating depth (e.g. 'flickering neon sign', 'overflowing dumpster')."
                    },
                    foreground_elements: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING },
                      description: "List 2-3 objects close to camera (e.g. 'rain drops on lens', 'blurry fence')."
                    },
                    weather_and_atmosphere: { type: Type.STRING, description: "Fog, rain, dust, steam, heat haze." }
                  },
                  required: ["setting", "background_elements", "foreground_elements", "weather_and_atmosphere"]
                },
                lighting: {
                  type: Type.OBJECT,
                  properties: {
                    primary_source: { type: Type.STRING },
                    color_palette: { type: Type.STRING },
                    shadows: { type: Type.STRING, description: "Hard, soft, long, nonexistent?" }
                  },
                  required: ["primary_source", "color_palette", "shadows"]
                },
                camera: {
                  type: Type.OBJECT,
                  properties: {
                    shot_type: { type: Type.STRING },
                    angle: { type: Type.STRING },
                    lens_characteristics: { type: Type.STRING, description: "Bokeh, distortion, sharpness, chromatic aberration." }
                  },
                  required: ["shot_type", "angle", "lens_characteristics"]
                }
              },
              required: ["contextual_inference", "subject_details", "environment", "lighting", "camera"]
            }
          },
          required: ["id", "text", "settingId", "characterIds", "quadrant", "temporalLogic", "timeOfDay", "keyVisualAction", "structuredScene"]
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
You are a **Forensic Text Segmenter** and **Visual Director**.
1. **SEGMENT**: Slice the story text into chunks of 3-4 sentences. STRICTLY VERBATIM.
2. **VISUALIZE**: For each chunk, create the high-fidelity \`structuredScene\` JSON.

# CRITICAL INSTRUCTION
Do NOT summarize the story.
Do NOT "fix" the text.
Do NOT skip sentences.
You are a photocopier for the text, and a painter for the metadata.

## STORY:
${storyText}

## STYLE:
${artStyle}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: 16384 },
      // Strict system instruction to enforce verbatim copy
      systemInstruction: `You are an automated transcription and visualization engine. 
      RULE 1: The 'text' property in the output MUST match the input text EXACTLY, chunk by chunk. 
      RULE 2: Use the Context Inference engine to fill in visual details that are implied but not stated. 
      Style: ${artStyle}`
    }
  });

  if (!response.text) throw new Error("No response from AI");
  const data = JSON.parse(response.text);

  // POST-PROCESSING: Compile the JSON back into a Rich Text Prompt for the Image Generator
  data.segments = data.segments.map((seg: any) => {
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
// IMPROVED IMAGE GENERATION
// ============================================

export const generateImage = async (
  prompt: string, 
  aspectRatio: AspectRatio = AspectRatio.SQUARE, 
  imageSize: ImageSize = ImageSize.K1,
  refImages?: string[],
  globalStyle?: string,
  cinematicDNA?: any
): Promise<string> => {
  const ai = getAi();
  
  let safeAspectRatio = aspectRatio;
  if (aspectRatio === AspectRatio.CINEMATIC) {
      safeAspectRatio = AspectRatio.WIDE;
  }

  const dnaPrompt = cinematicDNA ? `
    **GLOBAL CINEMATIC DNA:**
    Camera: ${cinematicDNA.cameraSystem}
    Palette: ${cinematicDNA.colorPalette}
    Mood: ${cinematicDNA.visualMood}
  ` : '';

  // The 'prompt' passed here is now the High-Density compiled string from analyzeStoryText
  const finalPrompt = `
${dnaPrompt}

**SCENE DEFINITION:**
${prompt}

**RENDER INSTRUCTIONS:**
- Photorealistic, cinematic 8K render.
- High dynamic range.
- Texture rich (pores, fabric weave, rust, dust).
- NO cartoons (unless style specified).
- NO empty spaces. Populate the frame based on the Environment lists above.
- **FORBIDDEN ELEMENTS**: Do NOT add snow, rain, floating particles, dust, or "magical sparkles" unless explicitly requested in the Scene Definition. The image should be clean.

**CONSISTENCY PROTOCOL:**
- IF Reference Images are provided:
   - IMAGE 1 (if present) is the MASTER CHARACTER ASSET. The character's face, hair, and MAIN CLOTHING must match this exactly.
   - IMAGE 2 (if present) is the SETTING ASSET. The architecture must match this.
   - IMAGE 3 (if present) is the PREVIOUS SCENE. Use this for lighting continuity and relative positioning, but prioritize Image 1 for character identity.
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
  };
  
  if (MODEL_IMAGE_GEN.includes('pro')) {
      imageConfig.imageSize = imageSize;
  }
  
  const systemInstruction = `You are a high-end renderer. You receive a structured data prompt. You must execute every detail. If the prompt mentions background elements, you MUST include them. Do NOT add environmental particles (snow, rain, dust) unless the prompt specifically asks for them. ${globalStyle || ''}`;

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
      // HANDLE IMAGE_OTHER ERROR (Common with Gemini 3 Pro Image)
      const isGenerationError = error.message?.includes('IMAGE_OTHER') || 
                                error.toString().includes('IMAGE_OTHER') ||
                                error.message?.includes('500') ||
                                error.message?.includes('503');

      if (isGenerationError) {
         console.warn(`Primary model ${MODEL_IMAGE_GEN} failed with error: ${error.message}. Falling back to ${MODEL_IMAGE_GEN_FALLBACK}.`);
         
         // Fallback configuration (No imageSize supported on Flash)
         const fallbackConfig = {
            aspectRatio: safeAspectRatio
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
             throw new Error(`Both primary and fallback models failed. Last error: ${fallbackError.message}`);
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

  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      if (candidate.finishReason === 'SAFETY') {
          throw new Error("Image generation blocked by safety filters.");
      }
      // If we are here, it's a failure reason we didn't catch in the try/catch or it passed through
      throw new Error(`AI Generation Failed. Reason: ${candidate.finishReason}`);
  }

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
        {
          inlineData: {
            mimeType: 'image/png',
            data: cleanBase64,
          },
        },
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

export const playAudio = async (audioData: ArrayBuffer): Promise<void> => {
    stopAudio(); // Stop any currently playing audio first

    const sampleRate = 24000;
    if (!audioContext) {
         audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
    }
    
    // Manual decoding of raw PCM
    const dataInt16 = new Int16Array(audioData);
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
        source.onended = () => {
            resolve();
        };
        source.start(0);
    });
};