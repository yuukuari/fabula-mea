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
  dailyGoal?: number;
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

// ─── Count Unit ───
export type CountUnit = 'words' | 'characters';

// ─── Notes & Ideas ───
export interface NoteIdea {
  id: EntityId;
  title: string;
  content: string; // HTML (TipTap)
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Library (multi-book) ───
export interface BookMeta {
  id: EntityId;
  title: string;
  author: string;
  genre?: string;
  writingMode: WritingMode;
  countUnit?: CountUnit;
  chaptersCount: number;
  scenesCount: number;
  charactersCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Tickets ───
export type TicketType = 'bug' | 'question' | 'improvement';
export type TicketVisibility = 'public' | 'private';
export type TicketStatus = 'open' | 'closed_done' | 'closed_duplicate';
export type TicketModule =
  | 'auth'
  | 'characters'
  | 'places'
  | 'chapters'
  | 'timeline'
  | 'progress'
  | 'world'
  | 'maps'
  | 'notes'
  | 'reviews'
  | 'settings'
  | 'export'
  | 'other';

export interface Ticket {
  id: EntityId;
  userId: string;
  userName: string;
  userEmail: string;
  type: TicketType;
  module?: TicketModule;
  title: string;
  description: string; // HTML from TipTap
  visibility: TicketVisibility;
  status: TicketStatus;
  releaseId?: string;
  reactions: Record<string, string[]>; // emoji → userId[]
  createdAt: string;
  updatedAt: string;
}

export interface TicketComment {
  id: EntityId;
  ticketId: string;
  userId: string;
  userName: string;
  isAdmin: boolean;
  content: string;
  reactions: Record<string, string[]>; // emoji → userId[]
  createdAt: string;
  updatedAt: string;
}

export interface TicketStatusChange {
  id: EntityId;
  ticketId: string;
  userId: string;
  userName: string;
  /** 'status_change' (default) or 'release_assign' */
  type?: 'status_change' | 'release_assign';
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  releaseId?: string;
  releaseName?: string;
  createdAt: string;
}

// ─── Releases ───
export type ReleaseStatus = 'draft' | 'planned' | 'current' | 'released';
export type ReleaseItemType = 'bugfix' | 'improvement' | 'feature';

export interface ReleaseItem {
  id: EntityId;
  type: ReleaseItemType;
  description: string;
}

export interface Release {
  id: EntityId;
  version: string; // x.y.z
  title: string;
  description: string; // HTML
  status: ReleaseStatus;
  items: ReleaseItem[];
  ticketIds: string[];
  releasedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Reviews (relecture) ───
export type ReviewSessionStatus = 'pending' | 'in_progress' | 'completed' | 'closed';
export type ReviewCommentStatus = 'draft' | 'sent' | 'closed';

export interface ReviewSnapshotChapter {
  id: EntityId;
  title?: string;
  number: number;
  synopsis?: string;
  color: string;
  sceneIds: EntityId[];
}

export interface ReviewSnapshotScene {
  id: EntityId;
  title?: string;
  description: string;
  chapterId: EntityId;
  orderInChapter: number;
  content?: string; // HTML (TipTap)
  characterIds: EntityId[];
  placeId?: EntityId;
}

export interface ReviewSession {
  id: EntityId;
  bookId: EntityId;
  bookTitle: string;
  authorName: string;
  authorEmail: string;
  userId: EntityId; // auteur
  token: string; // UUID public pour le lien
  readerName?: string;
  readerEmail?: string;
  status: ReviewSessionStatus;
  snapshot: {
    chapters: ReviewSnapshotChapter[];
    scenes: ReviewSnapshotScene[];
  };
  commentsCount: number;
  pendingCommentsCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  closedAt?: string;
}

export interface ReviewComment {
  id: EntityId;
  sessionId: EntityId;
  sceneId: EntityId;
  isAuthor: boolean;
  authorLabel: string; // nom du relecteur ou de l'auteur
  selectedText: string;
  /** Offset in plain text (HTML stripped) of the scene content */
  startOffset: number;
  endOffset: number;
  content: string;
  status: ReviewCommentStatus;
  parentId?: EntityId; // réponse à un autre commentaire
  createdAt: string;
  updatedAt: string;
}

// ─── Self-comments (author notes on their own scenes) ───
export interface SelfComment {
  id: EntityId;
  sceneId: EntityId;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  content: string;
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
  countUnit?: CountUnit;
  characters: Character[];
  places: Place[];
  chapters: Chapter[];
  scenes: Scene[];
  tags: Tag[];
  goals: ProjectGoals;
  writingSessions: WritingSession[];
  worldNotes: WorldNote[];
  maps: MapItem[];
  noteIdeas?: NoteIdea[];
  selfComments?: SelfComment[];
  graphNodePositions?: Record<string, { x: number; y: number }>;
  createdAt: string;
  updatedAt: string;
}
