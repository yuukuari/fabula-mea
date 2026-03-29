export type EntityId = string;

// ─── Tags ───
export interface Tag {
  id: EntityId;
  name: string;
  color: string;
}

// ─── Characters ───
export type CharacterSex = 'male' | 'female';

export interface Character {
  id: EntityId;
  name: string;
  surname?: string;
  nickname?: string;
  sex?: CharacterSex;
  age?: number;
  imageUrl?: string;
  description: string;
  personality: string;
  qualities: string[];
  flaws: string[];
  skills: string[];
  profession?: string;
  lifeGoal?: string;
  likes: string[];
  dislikes: string[];
  keyEvents: KeyEvent[];
  relationships: Relationship[];
  evolution: CharacterEvolution;
  tags: EntityId[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeyEvent {
  id: EntityId;
  title: string;
  description: string;
  date?: string;
}

export interface Relationship {
  id: EntityId;
  targetCharacterId: EntityId;
  type: RelationshipType;
  customType?: string;
  familyRoleSource?: string; // e.g. "Pere" (role of the source character)
  familyRoleTarget?: string; // e.g. "Fils" (role of the target character)
  description: string;
  evolution?: string;
}

export type RelationshipType =
  | 'family'
  | 'friend'
  | 'enemy'
  | 'lover'
  | 'mentor'
  | 'rival'
  | 'colleague'
  | 'custom';

export interface CharacterEvolution {
  beforeStory: string;
  duringStory: string;
  endOfStory: string;
  initiationJourney?: string;
}

// ─── Places ───
export interface Place {
  id: EntityId;
  name: string;
  type: PlaceType;
  description: string;
  imageUrl?: string;
  inspirations: string[];
  connectedPlaceIds: EntityId[];
  tags: EntityId[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PlaceType =
  | 'city'
  | 'village'
  | 'building'
  | 'room'
  | 'landscape'
  | 'country'
  | 'region'
  | 'other';

// ─── Chapters & Scenes ───
export interface Chapter {
  id: EntityId;
  title?: string;
  number: number;
  synopsis?: string;
  sceneIds: EntityId[];
  color: string;
  tags: EntityId[];
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: EntityId;
  title?: string;
  description: string;
  chapterId: EntityId;
  orderInChapter: number;
  characterIds: EntityId[];
  placeId?: EntityId;
  startDateTime?: string;
  endDateTime?: string;
  targetWordCount: number;
  currentWordCount: number; // manual in count mode, auto-computed in write mode
  content?: string;         // HTML (TipTap) – write mode only
  status: SceneStatus;
  tags: EntityId[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type SceneStatus = 'outline' | 'draft' | 'revision' | 'complete';

// ─── Goals & Progress ───
export interface ProjectGoals {
  targetEndDate?: string;
  startDate?: string;
  defaultWordsPerScene: number;
  excludedPeriods: ExcludedPeriod[];
}

export interface ExcludedPeriod {
  id: EntityId;
  startDate: string;
  endDate: string;
  label: string;
}

export interface WritingSession {
  id: EntityId;
  date: string;
  sceneId: EntityId;
  wordsWritten: number;
}

// ─── World-Building Notes ───
export interface WorldNote {
  id: EntityId;
  title: string;
  category: WorldNoteCategory;
  content: string;
  imageUrl?: string;
  linkedNoteIds: EntityId[];
  tags: EntityId[];
  createdAt: string;
  updatedAt: string;
}

export type WorldNoteCategory =
  | 'history'
  | 'culture'
  | 'magic_system'
  | 'politics'
  | 'religion'
  | 'technology'
  | 'flora_fauna'
  | 'language'
  | 'custom';

// ─── Maps ───
export interface MapPin {
  id: EntityId;
  placeId?: EntityId;    // linked place (optional)
  label?: string;        // custom label if no place linked
  x: number;             // percentage 0-100 of image width
  y: number;             // percentage 0-100 of image height
  color?: string;        // optional custom color
  linkedMapId?: EntityId; // drill-down: this pin opens another map
}

export interface MapItem {
  id: EntityId;
  name: string;
  description?: string;
  imageUrl: string;
  pins: MapPin[];
  createdAt: string;
  updatedAt: string;
}

// ─── Writing Mode ───
export type WritingMode = 'count' | 'write';

// ─── Library (multi-book) ───
export interface BookMeta {
  id: EntityId;
  title: string;
  author: string;
  genre?: string;
  writingMode: WritingMode;
  chaptersCount: number;
  scenesCount: number;
  charactersCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Root Store ───
export interface BookProject {
  id: EntityId;
  title: string;
  author: string;
  genre?: string;
  synopsis?: string;
  writingMode: WritingMode;
  characters: Character[];
  places: Place[];
  chapters: Chapter[];
  scenes: Scene[];
  tags: Tag[];
  goals: ProjectGoals;
  writingSessions: WritingSession[];
  worldNotes: WorldNote[];
  maps: MapItem[];
  graphNodePositions?: Record<string, { x: number; y: number }>;
  createdAt: string;
  updatedAt: string;
}
