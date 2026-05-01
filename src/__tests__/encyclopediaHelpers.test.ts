import { describe, it, expect } from 'vitest';
import {
  createCharacter,
  updateCharacter,
  deleteCharacter,
  reorderCharacters,
  addRelationship,
  updateRelationship,
  deleteRelationship,
  addKeyEvent,
  deleteKeyEvent,
  createPlace,
  updatePlace,
  deletePlace,
  createTag,
  updateTag,
  deleteTag,
  createWorldNote,
  updateWorldNote,
  deleteWorldNote,
  createMap,
  updateMap,
  deleteMap,
  addMapPin,
  updateMapPin,
  deleteMapPin,
} from '@/store/encyclopedia-helpers';

// ─── Character CRUD ───

describe('createCharacter', () => {
  it('creates a character with defaults and unique ID', () => {
    const { characters, id } = createCharacter([], { name: 'Alice' });
    expect(characters).toHaveLength(1);
    expect(characters[0].name).toBe('Alice');
    expect(characters[0].id).toBe(id);
    expect(id).toBeTruthy();
    expect(characters[0].relationships).toEqual([]);
    expect(characters[0].keyEvents).toEqual([]);
    expect(characters[0].tags).toEqual([]);
    expect(characters[0].inGlossary).toBe(false);
  });

  it('appends to existing array without mutating it', () => {
    const { characters: first } = createCharacter([], { name: 'Alice' });
    const { characters: second } = createCharacter(first, { name: 'Bob' });
    expect(second).toHaveLength(2);
    expect(first).toHaveLength(1); // original not mutated
  });

  it('generates unique IDs', () => {
    const { characters: first, id: id1 } = createCharacter([], { name: 'A' });
    const { id: id2 } = createCharacter(first, { name: 'B' });
    expect(id1).not.toBe(id2);
  });
});

describe('updateCharacter', () => {
  it('updates the specified character', () => {
    const { characters, id } = createCharacter([], { name: 'Alice' });
    const updated = updateCharacter(characters, id, { name: 'Alicia', age: 30 });
    expect(updated[0].name).toBe('Alicia');
    expect(updated[0].age).toBe(30);
  });

  it('does not modify other characters', () => {
    const { characters: c1, id: id1 } = createCharacter([], { name: 'Alice' });
    const { characters: c2 } = createCharacter(c1, { name: 'Bob' });
    const updated = updateCharacter(c2, id1, { name: 'Alicia' });
    expect(updated[1].name).toBe('Bob');
  });

  it('sets updatedAt timestamp', async () => {
    const { characters, id } = createCharacter([], { name: 'Alice' });
    const original = characters[0].updatedAt;
    // Wait 1ms to ensure different timestamp
    await new Promise((r) => setTimeout(r, 2));
    const updated = updateCharacter(characters, id, { name: 'Alicia' });
    expect(updated[0].updatedAt).not.toBe(original);
  });
});

describe('deleteCharacter', () => {
  it('removes the specified character', () => {
    const { characters: c1, id: id1 } = createCharacter([], { name: 'Alice' });
    const { characters: c2 } = createCharacter(c1, { name: 'Bob' });
    const result = deleteCharacter(c2, id1);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bob');
  });

  it('returns same length if ID not found', () => {
    const { characters } = createCharacter([], { name: 'Alice' });
    const result = deleteCharacter(characters, 'nonexistent');
    expect(result).toHaveLength(1);
  });
});

describe('reorderCharacters', () => {
  it('reorders characters and sets order field', () => {
    const { characters: c1, id: id1 } = createCharacter([], { name: 'Alice' });
    const { characters: c2, id: id2 } = createCharacter(c1, { name: 'Bob' });
    const { characters: c3, id: id3 } = createCharacter(c2, { name: 'Charlie' });
    const reordered = reorderCharacters(c3, [id3, id1, id2]);
    expect(reordered[0].name).toBe('Charlie');
    expect(reordered[0].order).toBe(0);
    expect(reordered[1].name).toBe('Alice');
    expect(reordered[1].order).toBe(1);
    expect(reordered[2].name).toBe('Bob');
    expect(reordered[2].order).toBe(2);
  });
});

// ─── Relationship CRUD ───

describe('addRelationship', () => {
  it('adds a relationship to the specified character', () => {
    const { characters, id } = createCharacter([], { name: 'Alice' });
    const updated = addRelationship(characters, id, {
      targetCharacterId: 'bob-id',
      type: 'friend',
      description: 'Best friends',
    });
    expect(updated[0].relationships).toHaveLength(1);
    expect(updated[0].relationships[0].type).toBe('friend');
    expect(updated[0].relationships[0].id).toBeTruthy(); // ID auto-generated
  });

  it('does not affect other characters', () => {
    const { characters: c1, id: id1 } = createCharacter([], { name: 'Alice' });
    const { characters: c2 } = createCharacter(c1, { name: 'Bob' });
    const updated = addRelationship(c2, id1, {
      targetCharacterId: 'x',
      type: 'enemy',
      description: '',
    });
    expect(updated[1].relationships).toHaveLength(0);
  });
});

describe('updateRelationship', () => {
  it('updates the specified relationship', () => {
    const { characters, id } = createCharacter([], { name: 'Alice' });
    const withRel = addRelationship(characters, id, {
      targetCharacterId: 'bob',
      type: 'friend',
      description: 'old',
    });
    const relId = withRel[0].relationships[0].id;
    const updated = updateRelationship(withRel, id, relId, { description: 'new' });
    expect(updated[0].relationships[0].description).toBe('new');
    expect(updated[0].relationships[0].type).toBe('friend'); // unchanged
  });
});

describe('deleteRelationship', () => {
  it('removes the specified relationship', () => {
    const { characters, id } = createCharacter([], { name: 'Alice' });
    const withRel = addRelationship(characters, id, {
      targetCharacterId: 'bob',
      type: 'friend',
      description: '',
    });
    const relId = withRel[0].relationships[0].id;
    const updated = deleteRelationship(withRel, id, relId);
    expect(updated[0].relationships).toHaveLength(0);
  });
});

// ─── Reciprocal Relationship Workflows ───

describe('reciprocal relationship workflow', () => {
  it('creates bidirectional relationships on both characters', () => {
    const { characters: c1, id: aliceId } = createCharacter([], { name: 'Alice' });
    const { characters: c2, id: bobId } = createCharacter(c1, { name: 'Bob' });

    // Add relationship Alice → Bob
    const c3 = addRelationship(c2, aliceId, {
      targetCharacterId: bobId,
      type: 'lover',
      description: 'In love',
    });
    // Add reverse relationship Bob → Alice (reciprocal)
    const c4 = addRelationship(c3, bobId, {
      targetCharacterId: aliceId,
      type: 'lover',
      description: 'In love',
    });

    const alice = c4.find((c) => c.id === aliceId)!;
    const bob = c4.find((c) => c.id === bobId)!;
    expect(alice.relationships).toHaveLength(1);
    expect(bob.relationships).toHaveLength(1);
    expect(alice.relationships[0].targetCharacterId).toBe(bobId);
    expect(bob.relationships[0].targetCharacterId).toBe(aliceId);
  });

  it('deleting both sides cleans up reciprocal relationship completely', () => {
    const { characters: c1, id: aliceId } = createCharacter([], { name: 'Alice' });
    const { characters: c2, id: bobId } = createCharacter(c1, { name: 'Bob' });

    // Create reciprocal relationship
    const c3 = addRelationship(c2, aliceId, {
      targetCharacterId: bobId,
      type: 'lover',
      description: 'In love',
    });
    const c4 = addRelationship(c3, bobId, {
      targetCharacterId: aliceId,
      type: 'lover',
      description: 'In love',
    });

    // Delete from Alice
    const aliceRelId = c4.find((c) => c.id === aliceId)!.relationships[0].id;
    const c5 = deleteRelationship(c4, aliceId, aliceRelId);

    // Delete from Bob (simulates bilateral deletion in CharacterDetail)
    const bobRelId = c5.find((c) => c.id === bobId)!.relationships[0].id;
    const c6 = deleteRelationship(c5, bobId, bobRelId);

    expect(c6.find((c) => c.id === aliceId)!.relationships).toHaveLength(0);
    expect(c6.find((c) => c.id === bobId)!.relationships).toHaveLength(0);
  });

  it('deleting only one side leaves the reverse as orphan (non-reciprocal)', () => {
    const { characters: c1, id: aliceId } = createCharacter([], { name: 'Alice' });
    const { characters: c2, id: bobId } = createCharacter(c1, { name: 'Bob' });

    // Create reciprocal relationship
    const c3 = addRelationship(c2, aliceId, {
      targetCharacterId: bobId,
      type: 'rival',
      description: '',
    });
    const c4 = addRelationship(c3, bobId, {
      targetCharacterId: aliceId,
      type: 'rival',
      description: '',
    });

    // Only delete Alice's side
    const aliceRelId = c4.find((c) => c.id === aliceId)!.relationships[0].id;
    const c5 = deleteRelationship(c4, aliceId, aliceRelId);

    expect(c5.find((c) => c.id === aliceId)!.relationships).toHaveLength(0);
    expect(c5.find((c) => c.id === bobId)!.relationships).toHaveLength(1); // orphan remains
  });

  it('non-reciprocal relationship only exists on one character', () => {
    const { characters: c1, id: aliceId } = createCharacter([], { name: 'Alice' });
    const { characters: c2, id: bobId } = createCharacter(c1, { name: 'Bob' });

    // Only Alice → Bob (non-reciprocal)
    const c3 = addRelationship(c2, aliceId, {
      targetCharacterId: bobId,
      type: 'mentor',
      description: 'Alice mentors Bob',
    });

    expect(c3.find((c) => c.id === aliceId)!.relationships).toHaveLength(1);
    expect(c3.find((c) => c.id === bobId)!.relationships).toHaveLength(0);
  });

  it('can detect if a reverse relationship exists for reciprocity check', () => {
    const { characters: c1, id: aliceId } = createCharacter([], { name: 'Alice' });
    const { characters: c2, id: bobId } = createCharacter(c1, { name: 'Bob' });

    // Create one-way relationship Alice → Bob
    const c3 = addRelationship(c2, aliceId, {
      targetCharacterId: bobId,
      type: 'lover',
      description: '',
    });

    // Check reciprocity (same logic used in RelationshipEditor and RelationshipGraph)
    const bob = c3.find((c) => c.id === bobId)!;
    const reverseExists = bob.relationships.some(
      (r) => r.targetCharacterId === aliceId && r.type === 'lover'
    );
    expect(reverseExists).toBe(false);

    // Now add reverse
    const c4 = addRelationship(c3, bobId, {
      targetCharacterId: aliceId,
      type: 'lover',
      description: '',
    });

    const bob2 = c4.find((c) => c.id === bobId)!;
    const reverseExists2 = bob2.relationships.some(
      (r) => r.targetCharacterId === aliceId && r.type === 'lover'
    );
    expect(reverseExists2).toBe(true);
  });
});

// ─── Key Event CRUD ───

describe('addKeyEvent', () => {
  it('adds a key event to the character', () => {
    const { characters, id } = createCharacter([], { name: 'Alice' });
    const updated = addKeyEvent(characters, id, {
      title: 'Naissance',
      description: 'Born in Paris',
    });
    expect(updated[0].keyEvents).toHaveLength(1);
    expect(updated[0].keyEvents[0].title).toBe('Naissance');
    expect(updated[0].keyEvents[0].id).toBeTruthy();
  });
});

describe('deleteKeyEvent', () => {
  it('removes the specified key event', () => {
    const { characters, id } = createCharacter([], { name: 'Alice' });
    const withEvent = addKeyEvent(characters, id, {
      title: 'Event 1',
      description: '',
    });
    const eventId = withEvent[0].keyEvents[0].id;
    const updated = deleteKeyEvent(withEvent, id, eventId);
    expect(updated[0].keyEvents).toHaveLength(0);
  });
});

// ─── Place CRUD ───

describe('createPlace', () => {
  it('creates a place with defaults', () => {
    const { places, id } = createPlace([], { name: 'Paris' });
    expect(places).toHaveLength(1);
    expect(places[0].name).toBe('Paris');
    expect(places[0].type).toBe('other');
    expect(places[0].id).toBe(id);
    expect(places[0].inGlossary).toBe(false);
  });
});

describe('updatePlace', () => {
  it('updates the specified place', () => {
    const { places, id } = createPlace([], { name: 'Paris' });
    const updated = updatePlace(places, id, { name: 'Lyon', type: 'city' });
    expect(updated[0].name).toBe('Lyon');
    expect(updated[0].type).toBe('city');
  });
});

describe('deletePlace', () => {
  it('removes the specified place', () => {
    const { places, id } = createPlace([], { name: 'Paris' });
    expect(deletePlace(places, id)).toHaveLength(0);
  });
});

// ─── Tag CRUD ───

describe('createTag', () => {
  it('creates a tag with default color', () => {
    const { tags, id } = createTag([], { name: 'Fantasy' });
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe('Fantasy');
    expect(tags[0].color).toBe('#6b7280');
    expect(tags[0].id).toBe(id);
  });
});

describe('updateTag', () => {
  it('updates the specified tag', () => {
    const { tags, id } = createTag([], { name: 'Fantasy' });
    const updated = updateTag(tags, id, { name: 'Sci-Fi', color: '#ff0000' });
    expect(updated[0].name).toBe('Sci-Fi');
    expect(updated[0].color).toBe('#ff0000');
  });
});

describe('deleteTag', () => {
  it('removes the specified tag', () => {
    const { tags, id } = createTag([], { name: 'Fantasy' });
    expect(deleteTag(tags, id)).toHaveLength(0);
  });
});

// ─── WorldNote CRUD ───

describe('createWorldNote', () => {
  it('creates a world note with defaults', () => {
    const { worldNotes, id } = createWorldNote([], { title: 'Magie' });
    expect(worldNotes).toHaveLength(1);
    expect(worldNotes[0].title).toBe('Magie');
    expect(worldNotes[0].category).toBe('custom');
    expect(worldNotes[0].id).toBe(id);
    expect(worldNotes[0].inGlossary).toBe(false);
    expect(worldNotes[0].connectedPlaceIds).toEqual([]);
  });

  it('preserves connectedPlaceIds when provided', () => {
    const { worldNotes } = createWorldNote([], { title: 'Histoire', connectedPlaceIds: ['p1', 'p2'] });
    expect(worldNotes[0].connectedPlaceIds).toEqual(['p1', 'p2']);
  });
});

describe('updateWorldNote', () => {
  it('updates the specified world note', () => {
    const { worldNotes, id } = createWorldNote([], { title: 'Magie' });
    const updated = updateWorldNote(worldNotes, id, { title: 'Système magique', category: 'magic_system' });
    expect(updated[0].title).toBe('Système magique');
    expect(updated[0].category).toBe('magic_system');
  });
});

describe('deleteWorldNote', () => {
  it('removes the specified world note', () => {
    const { worldNotes, id } = createWorldNote([], { title: 'Magie' });
    expect(deleteWorldNote(worldNotes, id)).toHaveLength(0);
  });
});

// ─── Map CRUD ───

describe('createMap', () => {
  it('creates a map with empty pins', () => {
    const { maps, id } = createMap([], { name: 'Carte du monde' });
    expect(maps).toHaveLength(1);
    expect(maps[0].name).toBe('Carte du monde');
    expect(maps[0].pins).toEqual([]);
    expect(maps[0].id).toBe(id);
  });
});

describe('updateMap', () => {
  it('updates the specified map', () => {
    const { maps, id } = createMap([], { name: 'Carte v1' });
    const updated = updateMap(maps, id, { name: 'Carte v2' });
    expect(updated[0].name).toBe('Carte v2');
  });
});

describe('deleteMap', () => {
  it('removes the specified map', () => {
    const { maps, id } = createMap([], { name: 'Carte' });
    expect(deleteMap(maps, id)).toHaveLength(0);
  });
});

// ─── MapPin CRUD ───

describe('addMapPin', () => {
  it('adds a pin to the specified map', () => {
    const { maps, id: mapId } = createMap([], { name: 'Map' });
    const { maps: updated, id: pinId } = addMapPin(maps, mapId, {
      x: 50,
      y: 30,
      label: 'Village',
    });
    expect(updated[0].pins).toHaveLength(1);
    expect(updated[0].pins[0].x).toBe(50);
    expect(updated[0].pins[0].y).toBe(30);
    expect(updated[0].pins[0].label).toBe('Village');
    expect(pinId).toBeTruthy();
  });

  it('does not affect other maps', () => {
    const { maps: m1, id: mapId1 } = createMap([], { name: 'Map 1' });
    const { maps: m2 } = createMap(m1, { name: 'Map 2' });
    const { maps: updated } = addMapPin(m2, mapId1, { x: 10, y: 20 });
    expect(updated[0].pins).toHaveLength(1);
    expect(updated[1].pins).toHaveLength(0);
  });
});

describe('updateMapPin', () => {
  it('updates the specified pin', () => {
    const { maps, id: mapId } = createMap([], { name: 'Map' });
    const { maps: withPin, id: pinId } = addMapPin(maps, mapId, { x: 10, y: 20, label: 'Old' });
    const updated = updateMapPin(withPin, mapId, pinId, { label: 'New', x: 90 });
    expect(updated[0].pins[0].label).toBe('New');
    expect(updated[0].pins[0].x).toBe(90);
    expect(updated[0].pins[0].y).toBe(20); // unchanged
  });
});

describe('deleteMapPin', () => {
  it('removes the specified pin', () => {
    const { maps, id: mapId } = createMap([], { name: 'Map' });
    const { maps: withPin, id: pinId } = addMapPin(maps, mapId, { x: 10, y: 20 });
    const updated = deleteMapPin(withPin, mapId, pinId);
    expect(updated[0].pins).toHaveLength(0);
  });
});
