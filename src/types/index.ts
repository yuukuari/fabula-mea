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
  imageOffsetY?: number; // percentage offset for avatar centering (0 = top, 50 = center, 100 = bottom)
  description: string;
  inGlossary?: boolean; // include in book glossary
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
  order?: number;
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
  inGlossary?: boolean; // include in book glossary
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

// ─── Timeline Events ───
export type DurationUnit = 'hours' | 'days' | 'months' | 'years';

export interface EventDuration {
  value: number;
  unit: DurationUnit;
}

export interface TimelineEvent {
  id: EntityId;
  title: string;
  description?: string;
  startDate: string;           // YYYY-MM-DD (date part)
  startTime?: string;          // HH:mm (optional, when user checks "include time")
  duration: EventDuration;
  order: number;               // position in the timeline sequence
  characterIds: EntityId[];
  placeId?: EntityId;
  chapterId?: EntityId;        // optional chapter reference
  sceneId?: EntityId;          // optional single scene reference (shares dates/duration with event)
  tags: EntityId[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Chapters & Scenes ───
export type ChapterType = 'front_matter' | 'chapter' | 'back_matter';

export interface Chapter {
  id: EntityId;
  title?: string;
  number: number;
  type?: ChapterType; // default: 'chapter'
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
  startDateTime?: string;   // @deprecated – kept for compat, use startDate+duration
  endDateTime?: string;     // @deprecated – kept for compat, use startDate+duration
  startDate?: string;       // YYYY-MM-DD
  startTime?: string;       // HH:mm (optional)
  duration?: EventDuration; // same model as TimelineEvent
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
export type GoalMode = 'total' | 'perScene' | 'none';
export type ObjectiveType = 'wordCount' | 'time';

export interface TimeObjective {
  hoursPerDay?: number;
  hoursPerWeek?: number;
  hoursPerMonth?: number;
}

export interface ProjectGoals {
  mode: GoalMode;                     // Longueur du livre (total/perScene/none)
  targetTotalCount?: number;          // Cas 1 : objectif total du livre (mots ou signes)
  targetCountPerScene?: number;       // Cas 2 : objectif par scène (mots ou signes)
  // Section objectif d'écriture
  objectiveEnabled: boolean;          // Je me fixe un objectif d'écriture
  objectiveType?: ObjectiveType;      // Type d'objectif : mots/signes ou temps
  targetEndDate?: string;             // Date cible de fin d'écriture
  manualDailyGoal?: number;           // Objectif journalier manuel (mode 'none' ou sans date cible)
  timeObjective?: TimeObjective;      // Objectif en temps d'écriture
  excludedPeriods: ExcludedPeriod[];
}

export interface DailySnapshot {
  date: string;                // YYYY-MM-DD
  totalWritten: number;        // Total mots/signes écrits à ce jour
  writtenToday: number;        // Mots/signes écrits dans la journée
  dailyGoal: number | null;    // Objectif journalier calculé ce jour-là
  objectiveType?: ObjectiveType; // Type d'objectif en vigueur
  timeGoal?: TimeObjective;    // Objectif en temps en vigueur
  writingMinutesToday?: number; // Minutes d'écriture chronométrées aujourd'hui
  targetTotal: number | null;  // Objectif total en vigueur
  targetEndDate: string | null;// Date cible en vigueur
  progress: number;            // Avancement global (0-1)
  completedScenes: number;     // Nombre de scènes terminées
  totalScenes: number;         // Nombre total de scènes
}

// ─── Writing Timer ───
export type WritingTimerMode = 'free' | 'timed' | 'pomodoro';

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
  inGlossary?: boolean; // include in book glossary
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
  sagaId?: EntityId;       // if this book belongs to a saga
  orderInSaga?: number;    // position within the saga
  chaptersCount: number;
  scenesCount: number;
  charactersCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Sagas ───
export interface SagaMeta {
  id: EntityId;
  title: string;
  description?: string;
  author?: string;
  genre?: string;
  writingMode: WritingMode;
  countUnit: CountUnit;
  layout?: BookLayout;
  imageUrl?: string;
  bookIds: EntityId[];    // ordered list of book IDs in this saga
  createdAt: string;
  updatedAt: string;
}

export interface SagaProject {
  id: EntityId;
  title: string;
  description?: string;
  imageUrl?: string;
  characters: Character[];
  places: Place[];
  worldNotes: WorldNote[];
  maps: MapItem[];
  tags: Tag[];
  graphNodePositions?: Record<string, { x: number; y: number }>;
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
  | 'writing'
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
  commentCount?: number;
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
  type?: 'status_change' | 'release_assign' | 'type_change' | 'module_change';
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  releaseId?: string;
  releaseName?: string;
  fromType?: TicketType;
  toType?: TicketType;
  fromModule?: TicketModule | null;
  toModule?: TicketModule | null;
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
  type?: ChapterType;
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

export type GlossaryEntryType = 'character' | 'place' | 'worldNote';

export interface GlossaryEntry {
  id: EntityId;
  type: GlossaryEntryType;
  name: string;
  description: string;
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
    glossary?: GlossaryEntry[];
    layout?: BookLayout;
    bookAuthor?: string;
  };
  commentsCount: number;
  pendingCommentsCount: number;
  authorDraftCount?: number;
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

// ─── Book Layout ───
export type BookFont = 'Times New Roman' | 'Georgia' | 'Crimson Text' | 'Lora' | 'Merriweather' | 'EB Garamond' | 'Libre Baskerville' | 'Garamond';
export type BookFontSize = 10 | 11 | 12 | 13 | 14 | 16 | 18;
export type BookLineHeight = 1.0 | 1.15 | 1.25 | 1.5 | 1.75 | 2.0;

export interface BookLayout {
  fontFamily: BookFont;
  fontSize: BookFontSize;
  lineHeight: BookLineHeight;
  coverFront?: string;   // base64 image
  coverBack?: string;    // base64 image
  coverSpine?: string;   // base64 image
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
  sagaId?: EntityId;        // if set, encyclopedia data lives in the saga
  glossaryEnabled?: boolean;
  tableOfContents?: boolean;
  layout?: BookLayout;
  characters: Character[];
  places: Place[];
  chapters: Chapter[];
  scenes: Scene[];
  tags: Tag[];
  goals: ProjectGoals;
  dailySnapshots: DailySnapshot[];
  writingSessions?: WritingSession[]; // @deprecated — kept for compat, unused
  worldNotes: WorldNote[];
  maps: MapItem[];
  timelineEvents?: TimelineEvent[];
  noteIdeas?: NoteIdea[];
  selfComments?: SelfComment[];
  graphNodePositions?: Record<string, { x: number; y: number }>;
  createdAt: string;
  updatedAt: string;
}
