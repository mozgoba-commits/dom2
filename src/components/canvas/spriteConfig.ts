// Character appearance configuration for chibi pixel art sprites

export interface CharacterAppearance {
  gender: 'male' | 'female'
  skinColor: string
  hairColor: string
  hairStyle: 'bald' | 'short' | 'medium' | 'long' | 'curly' | 'ponytail'
  shirtColor: string
  pantsColor: string
  accessory?: 'glasses' | 'earring' | 'beard' | 'bow'
  bodyBuild: 'slim' | 'normal' | 'muscular'
  accentColor: string // UI accent (chat colors, bubble borders)
}

export const CHARACTER_CONFIGS: Record<string, CharacterAppearance> = {
  'Руслан': {
    gender: 'male',
    skinColor: '#f0c8a0',
    hairColor: '#f0c8a0', // bald — same as skin
    hairStyle: 'bald',
    shirtColor: '#e63946',
    pantsColor: '#1a1a2e',
    bodyBuild: 'muscular',
    accentColor: '#e63946',
  },
  'Тимур': {
    gender: 'male',
    skinColor: '#d4a574',
    hairColor: '#2c1810',
    hairStyle: 'short',
    shirtColor: '#457b9d',
    pantsColor: '#2c3e50',
    accessory: 'beard',
    bodyBuild: 'normal',
    accentColor: '#457b9d',
  },
  'Алёна': {
    gender: 'female',
    skinColor: '#ffe0c0',
    hairColor: '#f5d77a',
    hairStyle: 'long',
    shirtColor: '#ff8fab',
    pantsColor: '#ffffff',
    bodyBuild: 'normal',
    accentColor: '#f4a261',
  },
  'Кристина': {
    gender: 'female',
    skinColor: '#f0c8a0',
    hairColor: '#2c1810',
    hairStyle: 'long',
    shirtColor: '#e76f51',
    pantsColor: '#e76f51', // dress (same as shirt)
    bodyBuild: 'slim',
    accentColor: '#e76f51',
  },
  'Марина': {
    gender: 'female',
    skinColor: '#f0c8a0',
    hairColor: '#8b7355',
    hairStyle: 'ponytail',
    shirtColor: '#2a9d8f',
    pantsColor: '#4a6fa5',
    accessory: 'glasses',
    bodyBuild: 'normal',
    accentColor: '#2a9d8f',
  },
  'Настя': {
    gender: 'female',
    skinColor: '#ffe0c0',
    hairColor: '#c45824',
    hairStyle: 'curly',
    shirtColor: '#f9c74f',
    pantsColor: '#8b6914',
    bodyBuild: 'slim',
    accentColor: '#f9c74f',
  },
  'Дима': {
    gender: 'male',
    skinColor: '#f0c8a0',
    hairColor: '#1a1a2e',
    hairStyle: 'long',
    shirtColor: '#90be6d',
    pantsColor: '#4a6fa5',
    accessory: 'earring',
    bodyBuild: 'slim',
    accentColor: '#90be6d',
  },
  'Олег': {
    gender: 'male',
    skinColor: '#d4a574',
    hairColor: '#4a3728',
    hairStyle: 'medium',
    shirtColor: '#9b5de5',
    pantsColor: '#4a6fa5',
    accessory: 'glasses',
    bodyBuild: 'normal',
    accentColor: '#9b5de5',
  },
}

const DEFAULT_APPEARANCE: CharacterAppearance = {
  gender: 'male',
  skinColor: '#f0c8a0',
  hairColor: '#4a3728',
  hairStyle: 'short',
  shirtColor: '#666677',
  pantsColor: '#333344',
  bodyBuild: 'normal',
  accentColor: '#888899',
}

export function getAppearance(name: string): CharacterAppearance {
  return CHARACTER_CONFIGS[name] ?? DEFAULT_APPEARANCE
}

export function getAccentColor(name: string): string {
  return (CHARACTER_CONFIGS[name] ?? DEFAULT_APPEARANCE).accentColor
}
