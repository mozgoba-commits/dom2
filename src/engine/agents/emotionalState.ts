import { EmotionalState, Mood, Agent } from '../types'

export function createDefaultEmotions(): EmotionalState {
  return {
    happiness: 50,
    anger: 0,
    sadness: 0,
    fear: 0,
    excitement: 30,
    jealousy: 0,
    love: 0,
    currentMood: 'neutral',
  }
}

export function moodToRussian(mood: Mood): string {
  const map: Record<Mood, string> = {
    happy: 'Весёлый',
    angry: 'Злой',
    sad: 'Грустный',
    excited: 'Взволнованный',
    jealous: 'Ревнивый',
    flirty: 'Флиртует',
    bored: 'Скучает',
    anxious: 'Тревожный',
    neutral: 'Спокойный',
    annoyed: 'Раздражённый',
    devastated: 'Убитый горем',
    euphoric: 'В эйфории',
    scheming: 'Что-то замышляет',
  }
  return map[mood] ?? 'Неизвестно'
}

export function getEmotionSummary(agent: Agent): string {
  const e = agent.emotions
  const parts: string[] = []

  if (e.anger > 60) parts.push('злится')
  if (e.sadness > 60) parts.push('расстроен(а)')
  if (e.happiness > 70) parts.push('счастлив(а)')
  if (e.excitement > 70) parts.push('возбуждён(а)')
  if (e.jealousy > 50) parts.push('ревнует')
  if (e.love > 60) parts.push('влюблён(а)')
  if (e.fear > 50) parts.push('боится')

  if (parts.length === 0) return 'чувствует себя нормально'
  return parts.join(', ')
}
