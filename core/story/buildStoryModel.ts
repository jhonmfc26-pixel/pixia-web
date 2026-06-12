import { v4 as uuidv4 } from 'uuid'
import type { StoryModel, OccasionType, PhotoStoryEntry } from './types'
import { buildChapters } from './buildChapters'

interface BuildStoryModelInput {
  sessionId: string
  occasion: OccasionType
  photos: { photoId: string; takenAt: string | null }[]
}

/**
 * Construye un StoryModel v0 a partir de los datos crudos de sesión.
 *
 * En esta fase (v0) solo se calculan capítulos temporales.
 * Personas (Fase 2) y roles semánticos (Fase 3) quedan pendientes.
 */
export function buildStoryModel(input: BuildStoryModelInput): StoryModel {
  const { sessionId, occasion, photos } = input

  const chapters = buildChapters(photos)

  const photoToChapter = new Map<string, string>()
  for (const chapter of chapters) {
    for (const photoId of chapter.photoIds) {
      photoToChapter.set(photoId, chapter.id)
    }
  }

  const storyPhotos: PhotoStoryEntry[] = photos.map(p => ({
    photoId: p.photoId,
    chapterId: photoToChapter.get(p.photoId),
    personIds: [],
    role: 'context',
  }))

  return {
    id: uuidv4(),
    sessionId,
    createdAt: new Date().toISOString(),
    version: 1,
    occasion,
    chapters,
    people: [],
    photos: storyPhotos,
  }
}
