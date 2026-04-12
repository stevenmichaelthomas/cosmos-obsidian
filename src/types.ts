export type BodyKind = 'gasgiant' | 'planet' | 'moon' | 'asteroid' | 'comet';
export type ContentType = 'haiku' | 'memory' | 'place' | 'note' | 'milestone';

export interface HaikuContent {
  line1: string;
  line2: string;
  line3: string;
}

export interface MemoryContent {
  title: string;
  description: string;
}

export interface PlaceContent {
  name: string;
  lat?: number;
  lng?: number;
}

export interface NoteContent {
  text: string;
}

export interface MilestoneContent {
  title: string;
}

export type EntryContent = HaikuContent | MemoryContent | PlaceContent | NoteContent | MilestoneContent;

export interface OrbitalParams {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  longitudeOfAscending: number;
  argumentOfPeriapsis: number;
  meanAnomalyAtEpoch: number;
  period: number;
  mass: number;
  bodyRadius: number;
  bodyColor: [number, number, number];
  hasRings: boolean;
  ringColor?: [number, number, number];
}
