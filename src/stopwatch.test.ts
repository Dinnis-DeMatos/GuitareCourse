import { describe, expect, it } from 'vitest'
import { createStopwatch } from './stopwatch.ts'

describe('createStopwatch', () => {
  it('garde le temps d’avant la pause et ne compte pas la pause', () => {
    let time = 0
    const watch = createStopwatch(() => time)
    watch.reset(true)
    time = 4000
    watch.stop()
    time = 34000 // 30 s de pause
    watch.start()
    time = 36000
    expect(watch.read()).toBe(6000)
  })

  it('repart de zéro à chaque consigne, arrêté si l’écoute est coupée', () => {
    let time = 1000
    const watch = createStopwatch(() => time)
    watch.reset(false)
    time = 5000
    expect(watch.read()).toBe(0)
    watch.start()
    watch.start() // deux reprises de suite ne remettent pas le départ à zéro
    time = 7000
    expect(watch.read()).toBe(2000)
  })
})
