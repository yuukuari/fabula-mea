/**
 * Hook that abstracts encyclopedia data access: reads from useSagaStore
 * when the current book belongs to a saga, otherwise from useBookStore.
 *
 * All encyclopedia pages (Characters, Places, World, Maps) and cross-referencing
 * pages (Timeline, Chapters, SearchDialog) should use this hook instead of
 * reading encyclopedia data directly from useBookStore.
 */

import { useBookStore } from './useBookStore';
import { useSagaStore } from './useSagaStore';

export function useEncyclopediaStore() {
  const sagaId = useBookStore((s) => s.sagaId);
  const isSagaMode = !!sagaId;

  // Characters
  const bookCharacters = useBookStore((s) => s.characters);
  const sagaCharacters = useSagaStore((s) => s.characters);
  const characters = isSagaMode ? sagaCharacters : bookCharacters;

  const bookAddCharacter = useBookStore((s) => s.addCharacter);
  const sagaAddCharacter = useSagaStore((s) => s.addCharacter);
  const addCharacter = isSagaMode ? sagaAddCharacter : bookAddCharacter;

  const bookUpdateCharacter = useBookStore((s) => s.updateCharacter);
  const sagaUpdateCharacter = useSagaStore((s) => s.updateCharacter);
  const updateCharacter = isSagaMode ? sagaUpdateCharacter : bookUpdateCharacter;

  const bookDeleteCharacter = useBookStore((s) => s.deleteCharacter);
  const sagaDeleteCharacter = useSagaStore((s) => s.deleteCharacter);
  const deleteCharacter = isSagaMode ? sagaDeleteCharacter : bookDeleteCharacter;

  const bookReorderCharacters = useBookStore((s) => s.reorderCharacters);
  const sagaReorderCharacters = useSagaStore((s) => s.reorderCharacters);
  const reorderCharacters = isSagaMode ? sagaReorderCharacters : bookReorderCharacters;

  const bookAddRelationship = useBookStore((s) => s.addRelationship);
  const sagaAddRelationship = useSagaStore((s) => s.addRelationship);
  const addRelationship = isSagaMode ? sagaAddRelationship : bookAddRelationship;

  const bookUpdateRelationship = useBookStore((s) => s.updateRelationship);
  const sagaUpdateRelationship = useSagaStore((s) => s.updateRelationship);
  const updateRelationship = isSagaMode ? sagaUpdateRelationship : bookUpdateRelationship;

  const bookDeleteRelationship = useBookStore((s) => s.deleteRelationship);
  const sagaDeleteRelationship = useSagaStore((s) => s.deleteRelationship);
  const deleteRelationship = isSagaMode ? sagaDeleteRelationship : bookDeleteRelationship;

  const bookAddKeyEvent = useBookStore((s) => s.addKeyEvent);
  const sagaAddKeyEvent = useSagaStore((s) => s.addKeyEvent);
  const addKeyEvent = isSagaMode ? sagaAddKeyEvent : bookAddKeyEvent;

  const bookDeleteKeyEvent = useBookStore((s) => s.deleteKeyEvent);
  const sagaDeleteKeyEvent = useSagaStore((s) => s.deleteKeyEvent);
  const deleteKeyEvent = isSagaMode ? sagaDeleteKeyEvent : bookDeleteKeyEvent;

  // Genealogy
  const bookAddGenealogyParent = useBookStore((s) => s.addGenealogyParent);
  const sagaAddGenealogyParent = useSagaStore((s) => s.addGenealogyParent);
  const addGenealogyParent = isSagaMode ? sagaAddGenealogyParent : bookAddGenealogyParent;

  const bookRemoveGenealogyParent = useBookStore((s) => s.removeGenealogyParent);
  const sagaRemoveGenealogyParent = useSagaStore((s) => s.removeGenealogyParent);
  const removeGenealogyParent = isSagaMode ? sagaRemoveGenealogyParent : bookRemoveGenealogyParent;

  const bookAddGenealogySpouse = useBookStore((s) => s.addGenealogySpouse);
  const sagaAddGenealogySpouse = useSagaStore((s) => s.addGenealogySpouse);
  const addGenealogySpouse = isSagaMode ? sagaAddGenealogySpouse : bookAddGenealogySpouse;

  const bookRemoveGenealogySpouse = useBookStore((s) => s.removeGenealogySpouse);
  const sagaRemoveGenealogySpouse = useSagaStore((s) => s.removeGenealogySpouse);
  const removeGenealogySpouse = isSagaMode ? sagaRemoveGenealogySpouse : bookRemoveGenealogySpouse;

  const bookUpdateGenealogySpouse = useBookStore((s) => s.updateGenealogySpouse);
  const sagaUpdateGenealogySpouse = useSagaStore((s) => s.updateGenealogySpouse);
  const updateGenealogySpouse = isSagaMode ? sagaUpdateGenealogySpouse : bookUpdateGenealogySpouse;

  const bookAddGenealogyChild = useBookStore((s) => s.addGenealogyChild);
  const sagaAddGenealogyChild = useSagaStore((s) => s.addGenealogyChild);
  const addGenealogyChild = isSagaMode ? sagaAddGenealogyChild : bookAddGenealogyChild;

  const bookRemoveGenealogyChild = useBookStore((s) => s.removeGenealogyChild);
  const sagaRemoveGenealogyChild = useSagaStore((s) => s.removeGenealogyChild);
  const removeGenealogyChild = isSagaMode ? sagaRemoveGenealogyChild : bookRemoveGenealogyChild;

  const bookReorderGenealogySpouses = useBookStore((s) => s.reorderGenealogySpouses);
  const sagaReorderGenealogySpouses = useSagaStore((s) => s.reorderGenealogySpouses);
  const reorderGenealogySpouses = isSagaMode ? sagaReorderGenealogySpouses : bookReorderGenealogySpouses;

  // Places
  const bookPlaces = useBookStore((s) => s.places);
  const sagaPlaces = useSagaStore((s) => s.places);
  const places = isSagaMode ? sagaPlaces : bookPlaces;

  const bookAddPlace = useBookStore((s) => s.addPlace);
  const sagaAddPlace = useSagaStore((s) => s.addPlace);
  const addPlace = isSagaMode ? sagaAddPlace : bookAddPlace;

  const bookUpdatePlace = useBookStore((s) => s.updatePlace);
  const sagaUpdatePlace = useSagaStore((s) => s.updatePlace);
  const updatePlace = isSagaMode ? sagaUpdatePlace : bookUpdatePlace;

  const bookDeletePlace = useBookStore((s) => s.deletePlace);
  const sagaDeletePlace = useSagaStore((s) => s.deletePlace);
  const deletePlace = isSagaMode ? sagaDeletePlace : bookDeletePlace;

  // Tags
  const bookTags = useBookStore((s) => s.tags);
  const sagaTags = useSagaStore((s) => s.tags);
  const tags = isSagaMode ? sagaTags : bookTags;

  const bookAddTag = useBookStore((s) => s.addTag);
  const sagaAddTag = useSagaStore((s) => s.addTag);
  const addTag = isSagaMode ? sagaAddTag : bookAddTag;

  const bookUpdateTag = useBookStore((s) => s.updateTag);
  const sagaUpdateTag = useSagaStore((s) => s.updateTag);
  const updateTag = isSagaMode ? sagaUpdateTag : bookUpdateTag;

  const bookDeleteTag = useBookStore((s) => s.deleteTag);
  const sagaDeleteTag = useSagaStore((s) => s.deleteTag);
  const deleteTag = isSagaMode ? sagaDeleteTag : bookDeleteTag;

  // World Notes
  const bookWorldNotes = useBookStore((s) => s.worldNotes);
  const sagaWorldNotes = useSagaStore((s) => s.worldNotes);
  const worldNotes = isSagaMode ? sagaWorldNotes : bookWorldNotes;

  const bookAddWorldNote = useBookStore((s) => s.addWorldNote);
  const sagaAddWorldNote = useSagaStore((s) => s.addWorldNote);
  const addWorldNote = isSagaMode ? sagaAddWorldNote : bookAddWorldNote;

  const bookUpdateWorldNote = useBookStore((s) => s.updateWorldNote);
  const sagaUpdateWorldNote = useSagaStore((s) => s.updateWorldNote);
  const updateWorldNote = isSagaMode ? sagaUpdateWorldNote : bookUpdateWorldNote;

  const bookDeleteWorldNote = useBookStore((s) => s.deleteWorldNote);
  const sagaDeleteWorldNote = useSagaStore((s) => s.deleteWorldNote);
  const deleteWorldNote = isSagaMode ? sagaDeleteWorldNote : bookDeleteWorldNote;

  // Maps
  const bookMaps = useBookStore((s) => s.maps);
  const sagaMaps = useSagaStore((s) => s.maps);
  const maps = isSagaMode ? sagaMaps : bookMaps;

  const bookAddMap = useBookStore((s) => s.addMap);
  const sagaAddMap = useSagaStore((s) => s.addMap);
  const addMap = isSagaMode ? sagaAddMap : bookAddMap;

  const bookUpdateMap = useBookStore((s) => s.updateMap);
  const sagaUpdateMap = useSagaStore((s) => s.updateMap);
  const updateMap = isSagaMode ? sagaUpdateMap : bookUpdateMap;

  const bookDeleteMap = useBookStore((s) => s.deleteMap);
  const sagaDeleteMap = useSagaStore((s) => s.deleteMap);
  const deleteMap = isSagaMode ? sagaDeleteMap : bookDeleteMap;

  const bookAddMapPin = useBookStore((s) => s.addMapPin);
  const sagaAddMapPin = useSagaStore((s) => s.addMapPin);
  const addMapPin = isSagaMode ? sagaAddMapPin : bookAddMapPin;

  const bookUpdateMapPin = useBookStore((s) => s.updateMapPin);
  const sagaUpdateMapPin = useSagaStore((s) => s.updateMapPin);
  const updateMapPin = isSagaMode ? sagaUpdateMapPin : bookUpdateMapPin;

  const bookDeleteMapPin = useBookStore((s) => s.deleteMapPin);
  const sagaDeleteMapPin = useSagaStore((s) => s.deleteMapPin);
  const deleteMapPin = isSagaMode ? sagaDeleteMapPin : bookDeleteMapPin;

  // Graph positions
  const bookGraphPositions = useBookStore((s) => s.graphNodePositions);
  const sagaGraphPositions = useSagaStore((s) => s.graphNodePositions);
  const graphNodePositions = isSagaMode ? sagaGraphPositions : bookGraphPositions;

  const bookSaveGraphPositions = useBookStore((s) => s.saveGraphNodePositions);
  const sagaSaveGraphPositions = useSagaStore((s) => s.saveGraphNodePositions);
  const saveGraphNodePositions = isSagaMode ? sagaSaveGraphPositions : bookSaveGraphPositions;

  return {
    isSagaMode,
    sagaId,

    // Characters
    characters,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    reorderCharacters,
    addRelationship,
    updateRelationship,
    deleteRelationship,
    addKeyEvent,
    deleteKeyEvent,

    // Genealogy
    addGenealogyParent,
    removeGenealogyParent,
    addGenealogySpouse,
    removeGenealogySpouse,
    updateGenealogySpouse,
    addGenealogyChild,
    removeGenealogyChild,
    reorderGenealogySpouses,

    // Places
    places,
    addPlace,
    updatePlace,
    deletePlace,

    // Tags
    tags,
    addTag,
    updateTag,
    deleteTag,

    // World Notes
    worldNotes,
    addWorldNote,
    updateWorldNote,
    deleteWorldNote,

    // Maps
    maps,
    addMap,
    updateMap,
    deleteMap,
    addMapPin,
    updateMapPin,
    deleteMapPin,

    // Graph
    graphNodePositions,
    saveGraphNodePositions,
  };
}
