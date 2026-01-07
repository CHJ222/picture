
export enum Page {
  Home = 'HOME',
  Record = 'RECORD',
  Generate = 'GENERATE',
  Result = 'RESULT'
}

export type RecordMode = 'protagonist' | 'story';

export interface VideoSnippet {
  id: string;
  blob: Blob;
  url: string;
  type: RecordMode;
  timestamp: number;
  duration: number;
  faceSnapshot?: Blob; // 自动捕捉的高清正脸
}

export interface StoryScene {
  pageNumber: number;
  narration: string;
  imagePrompt: string;
  imageUrl?: string;
}

export interface MagicStory {
  title: string;
  character: {
    name: string;
    visualDescription: string;
  };
  scenes: StoryScene[];
}
