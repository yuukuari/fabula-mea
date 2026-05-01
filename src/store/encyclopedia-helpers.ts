/**
 * Shared helpers for encyclopedia CRUD operations (characters, places, tags, world notes, maps).
 * Used by both useBookStore and useSagaStore to avoid code duplication.
 */
import type {
  Character, Place, Tag, WorldNote, MapItem, MapPin,
  Relationship, KeyEvent, WorldNoteCategory,
} from '@/types';
import { generateId, now } from '@/lib/utils';
import { isBase64, uploadImage } from '@/lib/upload';
import { cleanupGenealogyOnDelete } from './genealogy-helpers';

// ─── Base64 Migration ────────────────────────────────────────────────────────

interface HasImageUrl { imageUrl?: string; name?: string; title?: string }

/** Migrate base64 images to CDN for an array of entities with imageUrl. */
function migrateEntityImages(entities: HasImageUrl[], prefix: string, promises: Promise<void>[]): boolean {
  let migrated = false;
  for (const entity of entities) {
    if (entity.imageUrl && isBase64(entity.imageUrl)) {
      const label = `${prefix}-${entity.name || entity.title || 'item'}`;
      promises.push(uploadImage(entity.imageUrl, label).then((url) => { entity.imageUrl = url; migrated = true; }));
    }
  }
  return migrated;
}

/**
 * Migrate base64 images in encyclopedia entities (characters, places, worldNotes, maps).
 * Returns true if any migration occurred. Mutates in-place.
 */
export async function migrateEncyclopediaImages(data: {
  characters: Character[];
  places: Place[];
  worldNotes: WorldNote[];
  maps?: MapItem[];
}): Promise<boolean> {
  const promises: Promise<void>[] = [];
  let migrated = false;

  migrated = migrateEntityImages(data.characters, 'char', promises) || migrated;
  migrated = migrateEntityImages(data.places, 'place', promises) || migrated;
  migrated = migrateEntityImages(data.worldNotes, 'world', promises) || migrated;
  migrated = migrateEntityImages(data.maps ?? [], 'map', promises) || migrated;

  await Promise.all(promises);
  return migrated;
}

// ─── Character CRUD ──────────────────────────────────────────────────────────

export function createCharacter(characters: Character[], data: Partial<Character>): { characters: Character[]; id: string } {
  const timestamp = now();
  const id = generateId();
  const newChar: Character = {
    id,
    name: data.name ?? '',
    surname: data.surname ?? '',
    nickname: data.nickname ?? '',
    sex: data.sex,
    age: data.age,
    birthDate: data.birthDate,
    deathDate: data.deathDate,
    imageUrl: data.imageUrl ?? '',
    imageOffsetY: data.imageOffsetY,
    description: data.description ?? '',
    personality: data.personality ?? '',
    qualities: data.qualities ?? [],
    flaws: data.flaws ?? [],
    skills: data.skills ?? [],
    profession: data.profession ?? '',
    lifeGoal: data.lifeGoal ?? '',
    likes: data.likes ?? [],
    dislikes: data.dislikes ?? [],
    keyEvents: data.keyEvents ?? [],
    relationships: data.relationships ?? [],
    evolution: data.evolution ?? { beforeStory: '', duringStory: '', endOfStory: '' },
    tags: data.tags ?? [],
    notes: data.notes ?? '',
    inGlossary: data.inGlossary ?? false,
    hideFromRelationshipGraph: data.hideFromRelationshipGraph,
    genealogy: data.genealogy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { characters: [...characters, newChar], id };
}

export function updateCharacter(characters: Character[], id: string, data: Partial<Character>): Character[] {
  return characters.map((c) => (c.id === id ? { ...c, ...data, updatedAt: now() } : c));
}

export function deleteCharacter(characters: Character[], id: string): Character[] {
  const remaining = characters.filter((c) => c.id !== id);
  return cleanupGenealogyOnDelete(remaining, id);
}

export function reorderCharacters(characters: Character[], characterIds: string[]): Character[] {
  return characterIds.map((id, i) => {
    const char = characters.find((c) => c.id === id)!;
    return { ...char, order: i };
  });
}

export function reorderPlaces(places: Place[], placeIds: string[]): Place[] {
  return placeIds.map((id, i) => {
    const place = places.find((p) => p.id === id)!;
    return { ...place, order: i };
  });
}

export function reorderWorldNotes(notes: WorldNote[], noteIds: string[]): WorldNote[] {
  return noteIds.map((id, i) => {
    const note = notes.find((n) => n.id === id)!;
    return { ...note, order: i };
  });
}

// ─── Relationship CRUD ───────────────────────────────────────────────────────

export function addRelationship(characters: Character[], charId: string, rel: Omit<Relationship, 'id'>): Character[] {
  return characters.map((c) =>
    c.id === charId ? { ...c, relationships: [...c.relationships, { ...rel, id: generateId() }], updatedAt: now() } : c
  );
}

export function updateRelationship(characters: Character[], charId: string, relId: string, data: Partial<Relationship>): Character[] {
  return characters.map((c) =>
    c.id === charId
      ? { ...c, relationships: c.relationships.map((r) => (r.id === relId ? { ...r, ...data } : r)), updatedAt: now() }
      : c
  );
}

export function deleteRelationship(characters: Character[], charId: string, relId: string): Character[] {
  return characters.map((c) =>
    c.id === charId
      ? { ...c, relationships: c.relationships.filter((r) => r.id !== relId), updatedAt: now() }
      : c
  );
}

// ─── Key Event CRUD ──────────────────────────────────────────────────────────

export function addKeyEvent(characters: Character[], charId: string, event: Omit<KeyEvent, 'id'>): Character[] {
  return characters.map((c) =>
    c.id === charId ? { ...c, keyEvents: [...(c.keyEvents ?? []), { ...event, id: generateId() }], updatedAt: now() } : c
  );
}

export function deleteKeyEvent(characters: Character[], charId: string, eventId: string): Character[] {
  return characters.map((c) =>
    c.id === charId ? { ...c, keyEvents: (c.keyEvents ?? []).filter((e) => e.id !== eventId), updatedAt: now() } : c
  );
}

// ─── Place CRUD ──────────────────────────────────────────────────────────────

export function createPlace(places: Place[], data: Partial<Place>): { places: Place[]; id: string } {
  const timestamp = now();
  const id = generateId();
  const newPlace: Place = {
    id,
    name: data.name ?? '',
    type: data.type ?? 'other',
    description: data.description ?? '',
    imageUrl: data.imageUrl ?? '',
    inspirations: data.inspirations ?? [],
    connectedPlaceIds: data.connectedPlaceIds ?? [],
    tags: data.tags ?? [],
    notes: data.notes ?? '',
    order: places.length,
    inGlossary: data.inGlossary ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { places: [...places, newPlace], id };
}

export function updatePlace(places: Place[], id: string, data: Partial<Place>): Place[] {
  return places.map((p) => (p.id === id ? { ...p, ...data, updatedAt: now() } : p));
}

export function deletePlace(places: Place[], id: string): Place[] {
  return places.filter((p) => p.id !== id);
}

// ─── Tag CRUD ────────────────────────────────────────────────────────────────

export function createTag(tags: Tag[], data: Partial<Tag>): { tags: Tag[]; id: string } {
  const id = generateId();
  const newTag: Tag = { id, name: data.name ?? '', color: data.color ?? '#6b7280' };
  return { tags: [...tags, newTag], id };
}

export function updateTag(tags: Tag[], id: string, data: Partial<Tag>): Tag[] {
  return tags.map((t) => (t.id === id ? { ...t, ...data } : t));
}

export function deleteTag(tags: Tag[], id: string): Tag[] {
  return tags.filter((t) => t.id !== id);
}

// ─── WorldNote CRUD ──────────────────────────────────────────────────────────

export function createWorldNote(notes: WorldNote[], data: Partial<WorldNote>): { worldNotes: WorldNote[]; id: string } {
  const timestamp = now();
  const id = generateId();
  const newNote: WorldNote = {
    id,
    title: data.title ?? '',
    category: data.category ?? 'custom' as WorldNoteCategory,
    content: data.content ?? '',
    imageUrl: data.imageUrl ?? '',
    linkedNoteIds: data.linkedNoteIds ?? [],
    connectedPlaceIds: data.connectedPlaceIds ?? [],
    tags: data.tags ?? [],
    order: notes.length,
    inGlossary: data.inGlossary ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { worldNotes: [...notes, newNote], id };
}

export function updateWorldNote(notes: WorldNote[], id: string, data: Partial<WorldNote>): WorldNote[] {
  return notes.map((n) => (n.id === id ? { ...n, ...data, updatedAt: now() } : n));
}

export function deleteWorldNote(notes: WorldNote[], id: string): WorldNote[] {
  return notes.filter((n) => n.id !== id);
}

// ─── Map CRUD ────────────────────────────────────────────────────────────────

export function createMap(maps: MapItem[], data: Partial<MapItem>): { maps: MapItem[]; id: string } {
  const timestamp = now();
  const id = generateId();
  const newMap: MapItem = {
    id,
    name: data.name ?? '',
    imageUrl: data.imageUrl ?? '',
    pins: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { maps: [...maps, newMap], id };
}

export function updateMap(maps: MapItem[], id: string, data: Partial<MapItem>): MapItem[] {
  return maps.map((m) => (m.id === id ? { ...m, ...data, updatedAt: now() } : m));
}

export function deleteMap(maps: MapItem[], id: string): MapItem[] {
  return maps.filter((m) => m.id !== id);
}

export function addMapPin(maps: MapItem[], mapId: string, pin: Omit<MapPin, 'id'>): { maps: MapItem[]; id: string } {
  const id = generateId();
  const updated = maps.map((m) =>
    m.id === mapId ? { ...m, pins: [...m.pins, { ...pin, id }], updatedAt: now() } : m
  );
  return { maps: updated, id };
}

export function updateMapPin(maps: MapItem[], mapId: string, pinId: string, data: Partial<MapPin>): MapItem[] {
  return maps.map((m) =>
    m.id === mapId
      ? { ...m, pins: m.pins.map((p) => (p.id === pinId ? { ...p, ...data } : p)), updatedAt: now() }
      : m
  );
}

export function deleteMapPin(maps: MapItem[], mapId: string, pinId: string): MapItem[] {
  return maps.map((m) =>
    m.id === mapId ? { ...m, pins: m.pins.filter((p) => p.id !== pinId), updatedAt: now() } : m
  );
}
