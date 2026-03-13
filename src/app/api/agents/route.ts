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
    catchphrase: a.bio.catchphrase,
    physicalDescription: a.bio.physicalDescription,
    mood: a.emotions.currentMood,
    location: a.location,
    status: a.status,
    energy: Math.round(a.energy),
    isEvicted: a.isEvicted,
    evictedOnDay: a.evictedOnDay,
  }))

  return NextResponse.json({ agents })
}
