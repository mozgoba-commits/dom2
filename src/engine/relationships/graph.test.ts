import { describe, it, expect } from 'vitest'
import { RelationshipGraph } from './graph'

describe('RelationshipGraph', () => {
  it('creates relationships on first access', () => {
    const graph = new RelationshipGraph()
    const rel = graph.getOrCreate('a', 'b')
    expect(rel.friendship).toBe(0)
    expect(rel.romance).toBe(0)
    expect(rel.trust).toBe(0)
    expect(rel.rivalry).toBe(0)
    expect(rel.alliance).toBe(false)
  })

  it('returns null for non-existent relationships', () => {
    const graph = new RelationshipGraph()
    expect(graph.get('a', 'b')).toBeNull()
  })

  it('uses symmetric key (a,b same as b,a)', () => {
    const graph = new RelationshipGraph()
    graph.getOrCreate('a', 'b')
    expect(graph.get('b', 'a')).not.toBeNull()
  })

  it('updates friendship with clamping', () => {
    const graph = new RelationshipGraph()
    graph.update('a', 'b', { friendship: 50 })
    expect(graph.get('a', 'b')!.friendship).toBe(50)

    graph.update('a', 'b', { friendship: 80 })
    expect(graph.get('a', 'b')!.friendship).toBe(100) // clamped

    graph.update('a', 'b', { friendship: -250 })
    expect(graph.get('a', 'b')!.friendship).toBe(-100) // clamped
  })

  it('clamps romance to 0-100', () => {
    const graph = new RelationshipGraph()
    graph.update('a', 'b', { romance: -10 })
    expect(graph.get('a', 'b')!.romance).toBe(0)

    graph.update('a', 'b', { romance: 150 })
    expect(graph.get('a', 'b')!.romance).toBe(100)
  })

  it('tracks history with cap', () => {
    const graph = new RelationshipGraph()
    for (let i = 0; i < 60; i++) {
      graph.update('a', 'b', { friendship: 1 }, {
        tick: i, type: 'positive', description: `event ${i}`, impact: 1,
      })
    }
    expect(graph.get('a', 'b')!.history.length).toBe(50)
  })

  it('filters friends correctly', () => {
    const graph = new RelationshipGraph()
    graph.update('a', 'b', { friendship: 50 })
    graph.update('a', 'c', { friendship: 10 })
    graph.update('a', 'd', { friendship: 40 })

    const friends = graph.getFriends('a', 30)
    expect(friends.length).toBe(2)
    expect(friends[0].friendship).toBe(50) // sorted desc
  })

  it('filters rivals correctly', () => {
    const graph = new RelationshipGraph()
    graph.update('a', 'b', { rivalry: 60 })
    graph.update('a', 'c', { rivalry: 10 })

    const rivals = graph.getRivals('a', 30)
    expect(rivals.length).toBe(1)
  })

  it('sets alliance flag', () => {
    const graph = new RelationshipGraph()
    graph.setAlliance('a', 'b', true)
    expect(graph.get('a', 'b')!.alliance).toBe(true)

    graph.setAlliance('a', 'b', false)
    expect(graph.get('a', 'b')!.alliance).toBe(false)
  })

  it('serializes and loads correctly', () => {
    const graph = new RelationshipGraph()
    graph.update('a', 'b', { friendship: 50, romance: 30 })
    graph.setAlliance('a', 'b', true)

    const json = graph.toJSON()
    const graph2 = new RelationshipGraph()
    graph2.loadData(json)

    const rel = graph2.get('a', 'b')
    expect(rel!.friendship).toBe(50)
    expect(rel!.romance).toBe(30)
    expect(rel!.alliance).toBe(true)
  })
})
