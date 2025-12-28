import JSZip from 'jszip';
import saveAs from 'file-saver';
import { StoryData, Character, Setting, StorySegment } from '../types';

// Helper to extract base64 data
const getBase64Data = (dataUrl: string) => dataUrl.split(',')[1];

export const exportProject = async (storyData: StoryData) => {
  const zip = new JSZip();
  const assetsFolder = zip.folder("assets");
  
  // Clone data to avoid mutating state
  const dataToSave = JSON.parse(JSON.stringify(storyData));
  
  // Process Characters
  dataToSave.characters.forEach((char: Character) => {
    if (char.imageUrl && char.imageUrl.startsWith('data:')) {
      const fileName = `char_${char.id}.png`;
      assetsFolder?.file(fileName, getBase64Data(char.imageUrl), { base64: true });
      char.imageUrl = `assets/${fileName}`;
    }
  });

  // Process Settings
  dataToSave.settings.forEach((setting: Setting) => {
    if (setting.imageUrl && setting.imageUrl.startsWith('data:')) {
      const fileName = `setting_${setting.id}.png`;
      assetsFolder?.file(fileName, getBase64Data(setting.imageUrl), { base64: true });
      setting.imageUrl = `assets/${fileName}`;
    }
  });

  // Process Segments (Updated for Grid System)
  // Cast to any to handle legacy property cleanup
  dataToSave.segments.forEach((segment: any) => {
    // 1. Save the selected/cropped final image
    if (segment.generatedImageUrl && segment.generatedImageUrl.startsWith('data:')) {
      const fileName = `segment_${segment.id}_final.png`;
      assetsFolder?.file(fileName, getBase64Data(segment.generatedImageUrl), { base64: true });
      segment.generatedImageUrl = `assets/${fileName}`;
    }
    
    // 2. Save the MASTER GRID image
    if (segment.masterGridImageUrl && segment.masterGridImageUrl.startsWith('data:')) {
      const fileName = `segment_${segment.id}_master_grid.png`;
      assetsFolder?.file(fileName, getBase64Data(segment.masterGridImageUrl), { base64: true });
      segment.masterGridImageUrl = `assets/${fileName}`;
    }
    
    // Clean up old fields
    if (segment.imageOptions) {
      delete segment.imageOptions;
    }
  });

  // Add the JSON file
  zip.file("story_data.json", JSON.stringify(dataToSave, null, 2));

  // Generate and save
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `storyboard_project_${new Date().toISOString().slice(0, 10)}.zip`);
};

export const importProject = async (file: File): Promise<StoryData> => {
  const zip = await JSZip.loadAsync(file);
  
  const jsonFile = zip.file("story_data.json");
  if (!jsonFile) throw new Error("Invalid project file: story_data.json not found");

  const jsonContent = await jsonFile.async("string");
  const storyData = JSON.parse(jsonContent);

  // Helper to reconstruct Base64
  const reconstructImage = async (path: string): Promise<string | undefined> => {
    if (!path || !path.startsWith('assets/')) return path;
    const fileName = path.split('/')[1];
    const imgFile = zip.folder("assets")?.file(fileName);
    if (imgFile) {
      const base64 = await imgFile.async("base64");
      return `data:image/png;base64,${base64}`;
    }
    return undefined;
  };

  // Restore images
  await Promise.all(storyData.characters.map(async (c: any) => {
    if (c.imageUrl) c.imageUrl = await reconstructImage(c.imageUrl);
  }));

  await Promise.all(storyData.settings.map(async (s: any) => {
    if (s.imageUrl) s.imageUrl = await reconstructImage(s.imageUrl);
  }));

  await Promise.all(storyData.segments.map(async (s: any) => {
    // Restore cropped final
    if (s.generatedImageUrl) s.generatedImageUrl = await reconstructImage(s.generatedImageUrl);
    // Restore master grid
    if (s.masterGridImageUrl) s.masterGridImageUrl = await reconstructImage(s.masterGridImageUrl);
  }));

  return storyData as StoryData;
};