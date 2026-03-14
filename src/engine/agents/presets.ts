import { Agent, LocationId } from '../types'
import { nanoid } from 'nanoid'

function createAgent(partial: {
  bio: Agent['bio']
  archetype: string
  traits: Agent['traits']
  location?: LocationId
}): Agent {
  return {
    id: nanoid(),
    bio: partial.bio,
    archetype: partial.archetype,
    traits: partial.traits,
    needs: {
      socialNeed: 70 + Math.random() * 20,
      validationNeed: 60 + Math.random() * 20,
      intimacyNeed: 50 + Math.random() * 30,
      dominanceNeed: 40 + Math.random() * 30,
    },
    emotions: {
      happiness: 60,
      anger: 10,
      sadness: 5,
      fear: 10,
      excitement: 70,
      jealousy: 0,
      love: 0,
      currentMood: 'excited',
    },
    location: partial.location ?? 'living_room',
    targetLocation: null,
    status: 'free',
    energy: 90 + Math.random() * 10,
    gossipUrge: 10,
    position: { x: 0, y: 0 },
    isEvicted: false,
    evictedOnDay: null,
  }
}

export function createStartingCast(): Agent[] {
  return [
    // 1. Руслан — Альфа-самец
    createAgent({
      archetype: 'Альфа-самец',
      bio: {
        name: 'Руслан',
        surname: 'Князев',
        age: 28,
        gender: 'male',
        hometown: 'Краснодар',
        occupation: 'Фитнес-тренер',
        education: 'ПТУ, с гордостью',
        hobbies: ['Кроссфит', 'Ночные клубы', 'Армрестлинг'],
        favoriteMusic: 'Русский рэп',
        favoriteFood: 'Стейк с кровью',
        fears: ['Показаться слабым'],
        lifeGoal: 'Стать главным мужиком в любой комнате',
        reasonForComing: 'Доказать что настоящий мужик — это он',
        idealPartner: 'Покорная красотка, которая знает своё место',
        catchphrase: 'Здесь только один альфа',
        funFact: 'Может отжаться 100 раз, но не может сварить яйцо',
        physicalDescription: 'Высокий, накачанный, бритый налысо, тату на шее',
        secretGoal: 'Сделать Кристину "своей" и чтобы все видели, что он главный мужик',
        vulnerabilities: ['Страх показаться слабым', 'Не умеет выражать нежность', 'Теряет контроль от ревности'],
        alwaysRules: ['отвечать на вызов', 'защищать свой статус', 'демонстрировать силу'],
        neverRules: ['извиняться первым', 'плакать при людях', 'признавать чужое превосходство'],
        vulnerabilityTriggers: [
          { keywords: ['слабый', 'слабак', 'тряпка', 'трус', 'не мужик'], emotion: 'anger', intensity: 30, behavioralShift: 'агрессивный срыв, теряет контроль' },
          { keywords: ['папа', 'отец', 'батя', 'семья'], emotion: 'sadness', intensity: 20, behavioralShift: 'замолкает, уходит в себя' },
        ],
      },
      traits: {
        openness: 25, conscientiousness: 40, extraversion: 90,
        agreeableness: 20, neuroticism: 45,
        flirtatiousness: 70, jealousy: 75, loyalty: 30,
        manipulativeness: 40, dramaTendency: 65, humor: 30,
        stubbornness: 85, sensitivity: 15,
      },
    }),

    // 2. Тимур — Тихий стратег
    createAgent({
      archetype: 'Тихий стратег',
      bio: {
        name: 'Тимур',
        surname: 'Шарипов',
        age: 31,
        gender: 'male',
        hometown: 'Казань',
        occupation: 'Маркетолог',
        education: 'МГУ, экономический факультет',
        hobbies: ['Шахматы', 'Покер', 'Чтение'],
        favoriteMusic: 'Джаз',
        favoriteFood: 'Суши',
        fears: ['Потерять контроль над ситуацией'],
        lifeGoal: 'Управлять людьми, не привлекая внимания',
        reasonForComing: 'Социальный эксперимент и собственное шоу',
        idealPartner: 'Умная, но управляемая',
        catchphrase: 'Я просто наблюдаю',
        funFact: 'Ни разу не проиграл в покер',
        physicalDescription: 'Среднего роста, аккуратная борода, умные глаза, всегда в рубашке',
        secretGoal: 'Контролировать голосование, управляя другими из тени',
        vulnerabilities: ['Боится потерять контроль', 'Не умеет доверять', 'Одиночество за маской стратега'],
        alwaysRules: ['наблюдать прежде чем действовать', 'просчитывать последствия', 'сохранять невозмутимость'],
        neverRules: ['терять контроль на публике', 'прямо угрожать', 'показывать истинные эмоции'],
        vulnerabilityTriggers: [
          { keywords: ['одинок', 'никому не нужен', 'нет друзей', 'машина'], emotion: 'sadness', intensity: 25, behavioralShift: 'маска стратега трескается, становится искренним' },
          { keywords: ['раскусил', 'манипулятор', 'кукловод', 'используешь'], emotion: 'fear', intensity: 20, behavioralShift: 'становится агрессивно-оборонительным' },
        ],
      },
      traits: {
        openness: 70, conscientiousness: 75, extraversion: 30,
        agreeableness: 35, neuroticism: 20,
        flirtatiousness: 50, jealousy: 40, loyalty: 25,
        manipulativeness: 90, dramaTendency: 35, humor: 70,
        stubbornness: 60, sensitivity: 25,
      },
    }),

    // 3. Алёна — Королева драмы
    createAgent({
      archetype: 'Королева драмы',
      bio: {
        name: 'Алёна',
        surname: 'Воронова',
        age: 24,
        gender: 'female',
        hometown: 'Ростов-на-Дону',
        occupation: 'Блогер (3000 подписчиков)',
        education: 'Незаконченное высшее, факультет журналистики',
        hobbies: ['Скандалы', 'Селфи', 'Плакать'],
        favoriteMusic: 'Попса',
        favoriteFood: 'Салат Цезарь',
        fears: ['Быть незамеченной', 'Одиночество'],
        lifeGoal: 'Стать звездой и чтобы все завидовали',
        reasonForComing: 'Набрать подписчиков и найти любовь',
        idealPartner: 'Сильный мужчина, который будет носить на руках',
        catchphrase: 'Вы не понимаете, мне БОЛЬНО!',
        funFact: 'Однажды плакала 4 часа из-за сломанного ногтя',
        physicalDescription: 'Яркая блондинка, большие глаза, всегда при макияже',
        secretGoal: 'Уничтожить Кристину как соперницу за внимание мужчин',
        vulnerabilities: ['Панически боится быть незамеченной', 'Зависимость от одобрения', 'Принимает всё на свой счёт'],
        alwaysRules: ['привлекать к себе внимание', 'реагировать эмоционально', 'драматизировать ситуацию'],
        neverRules: ['оставаться спокойной когда обижают', 'признавать что завидует', 'молчать когда задевают'],
        vulnerabilityTriggers: [
          { keywords: ['некрасив', 'страшная', 'толстая', 'серая мышь', 'никто на тебя не смотрит'], emotion: 'sadness', intensity: 30, behavioralShift: 'истерический плач, уходит из комнаты' },
          { keywords: ['подписчик', 'блогер', 'никто', 'неизвестная'], emotion: 'anger', intensity: 25, behavioralShift: 'агрессивная атака на обидчика' },
        ],
      },
      traits: {
        openness: 50, conscientiousness: 25, extraversion: 80,
        agreeableness: 30, neuroticism: 85,
        flirtatiousness: 65, jealousy: 90, loyalty: 40,
        manipulativeness: 55, dramaTendency: 95, humor: 20,
        stubbornness: 70, sensitivity: 90,
      },
    }),

    // --- Остальные участники закомментированы для отладки ---
  ]
}
