import { NextRequest, NextResponse } from 'next/server'
import { getSimulation } from '../../../engine/simulationManager'

export async function GET() {
  const sim = getSimulation()
  const agents = sim.state.agents.map(a => ({
    id: a.id,
    name: a.bio.name,
    surname: a.bio.surname,
    age: a.bio.age,
    gender: a.bio.gender,
    archetype: a.archetype,
    hometown: a.bio.hometown,
    occupation: a.bio.occupation,
    education: a.bio.education,
    catchphrase: a.bio.catchphrase,
    physicalDescription: a.bio.physicalDescription,
    hobbies: a.bio.hobbies,
    favoriteMusic: a.bio.favoriteMusic,
    favoriteFood: a.bio.favoriteFood,
    fears: a.bio.fears,
    lifeGoal: a.bio.lifeGoal,
    reasonForComing: a.bio.reasonForComing,
    idealPartner: a.bio.idealPartner,
    funFact: a.bio.funFact,
    secretGoal: a.bio.secretGoal,
    vulnerabilities: a.bio.vulnerabilities,
    mood: a.emotions.currentMood,
    location: a.location,
    status: a.status,
    energy: Math.round(a.energy),
    isEvicted: a.isEvicted,
    evictedOnDay: a.evictedOnDay,
  }))

  return NextResponse.json({ agents })
}
