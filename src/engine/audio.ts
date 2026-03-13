// Procedural audio manager using Web Audio API
// Generates soft ambient sounds and gentle notification tones

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let ambientNodes: OscillatorNode[] = []
let isMuted = false

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
    masterGain = audioCtx.createGain()
    masterGain.gain.value = 0.08 // very quiet master
    masterGain.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function getGain(): GainNode {
  getCtx()
  return masterGain!
}

export function setMuted(muted: boolean) {
  isMuted = muted
  if (masterGain) {
    masterGain.gain.value = muted ? 0 : 0.08
  }
}

export function isMutedState(): boolean {
  return isMuted
}

// --- Notification sounds ---

export function playNotification(type: 'drama' | 'message' | 'vote' | 'eviction') {
  if (isMuted) return
  const ctx = getCtx()
  const gain = ctx.createGain()
  gain.connect(getGain())

  const now = ctx.currentTime

  switch (type) {
    case 'drama': {
      // Gentle two-note chime (like a soft doorbell)
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.connect(gain)
      osc.frequency.setValueAtTime(330, now)
      osc.frequency.setValueAtTime(440, now + 0.2)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05) // soft attack
      gain.gain.linearRampToValueAtTime(0.12, now + 0.2)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
      osc.start(now)
      osc.stop(now + 0.8)
      break
    }

    case 'message': {
      // Soft blip — low-pitched, short
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.connect(gain)
      osc.frequency.setValueAtTime(350, now)
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.12)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.1, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.2)
      break
    }

    case 'vote': {
      // Gentle rising tone (two soft notes)
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      gain2.connect(getGain())
      osc1.type = 'triangle'
      osc2.type = 'sine'
      osc1.connect(gain)
      osc2.connect(gain2)

      osc1.frequency.setValueAtTime(260, now)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.1, now + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc1.start(now)
      osc1.stop(now + 0.3)

      osc2.frequency.setValueAtTime(390, now + 0.2)
      gain2.gain.setValueAtTime(0, now + 0.2)
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.25)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
      osc2.start(now + 0.2)
      osc2.stop(now + 0.6)
      break
    }

    case 'eviction': {
      // Low soft hum fading out
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.connect(gain)
      osc.frequency.setValueAtTime(120, now)
      osc.frequency.linearRampToValueAtTime(80, now + 1.5)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.12, now + 0.3) // slow fade in
      gain.gain.linearRampToValueAtTime(0.08, now + 1.0)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0)
      osc.start(now)
      osc.stop(now + 2.0)
      break
    }
  }
}

// --- Ambient sounds ---

export function startAmbient(timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night') {
  stopAmbient()
  if (isMuted) return

  const ctx = getCtx()

  switch (timeOfDay) {
    case 'night': {
      // Gentle low-frequency hum with slow pulsing — crickets feel
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const lfo = ctx.createOscillator()
        const lfoGain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.value = 180 + i * 40 // 180Hz, 220Hz — low and warm
        lfo.type = 'sine'
        lfo.frequency.value = 0.4 + i * 0.15 // very slow pulsing
        lfoGain.gain.value = 0.005

        lfo.connect(lfoGain)
        lfoGain.connect(gain.gain)
        osc.connect(gain)
        gain.gain.value = 0.008
        gain.connect(getGain())

        osc.start()
        lfo.start()
        ambientNodes.push(osc, lfo)
      }
      break
    }

    case 'morning': {
      // Gentle birdsong: very soft sine with slow vibrato
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = 600 // warm mid-range
      lfo.type = 'sine'
      lfo.frequency.value = 3 // gentle warble, not frantic
      lfoGain.gain.value = 60 // subtle frequency wobble

      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      osc.connect(gain)
      gain.gain.value = 0.006
      gain.connect(getGain())

      osc.start()
      lfo.start()
      ambientNodes.push(osc, lfo)
      break
    }

    case 'evening': {
      // Very soft low drone
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = 130
      lfo.type = 'sine'
      lfo.frequency.value = 0.2
      lfoGain.gain.value = 10

      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      osc.connect(gain)
      gain.gain.value = 0.008
      gain.connect(getGain())

      osc.start()
      lfo.start()
      ambientNodes.push(osc, lfo)
      break
    }

    case 'afternoon':
      // Quiet — no ambient
      break
  }
}

export function stopAmbient() {
  for (const node of ambientNodes) {
    try { node.stop() } catch { /* already stopped */ }
  }
  ambientNodes = []
}

// --- Campfire crackle ---

export function playCampfireCrackle() {
  if (isMuted) return
  const ctx = getCtx()
  const gain = ctx.createGain()
  gain.connect(getGain())

  // Short noise burst — very quiet
  const bufferSize = ctx.sampleRate * 0.04
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.15
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(gain)
  gain.gain.setValueAtTime(0.04, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
  source.start()
}
