import { onBeforeUnmount, onMounted, type Ref } from 'vue'

type Gsap = typeof import('gsap')['gsap']

const MOTION_ALLOWED = '(prefers-reduced-motion: no-preference)'

/**
 * The landing page's one orchestrated motion pass. The page renders every
 * demo in its finished state, so a visitor without the script, or with reduced
 * motion, reads the same content; this only replays how each state was reached.
 * GSAP loads after mount in its own chunk and never enters the shared bundle,
 * and a visitor who already prefers reduced motion never downloads it.
 */
export function useLandingMotion(root: Ref<HTMLElement | undefined>) {
  let revert: (() => void) | undefined
  let unmounted = false

  onMounted(async () => {
    const element = root.value
    if (!element || typeof window.matchMedia !== 'function') return
    const settle = () => element.querySelector('[data-motion="deck"]')?.classList.add('is-dealt')
    if (!window.matchMedia(MOTION_ALLOWED).matches) {
      settle()
      return
    }

    try {
      const [{ gsap }, { ScrollTrigger }, { DrawSVGPlugin }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('gsap/DrawSVGPlugin'),
      ])
      if (unmounted) return
      gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin)

      // matchMedia scopes every tween and ScrollTrigger to the query: switching
      // reduced motion on mid-visit reverts them all to the finished page.
      const media = gsap.matchMedia()
      media.add(MOTION_ALLOWED, () => {
        dealDeck(gsap, element)
        for (const demo of element.querySelectorAll<HTMLElement | SVGElement>('[data-demo]')) {
          const timeline = demoTimeline(gsap, demo)
          if (!timeline) continue
          ScrollTrigger.create({ trigger: demo, start: 'top 85%', once: true, onEnter: () => { timeline.play() } })
        }
        return settle
      }, element)
      revert = () => media.revert()
    }
    catch {
      // Motion is an enhancement: a failed chunk leaves the finished page in place.
      settle()
    }
  })

  onBeforeUnmount(() => {
    unmounted = true
    revert?.()
  })
}

/** How much further each slip is turned while it is dealt, on top of its resting tilt. */
const DEAL_TILT = [-7, 6, -5]

/*
 * Every tween here animates opacity rather than visibility: the stylesheet's
 * fallback reveal can only override opacity, clip-path and transform, so a deal
 * that stalls (a background tab that never paints) still settles visibly.
 */
function dealDeck(gsap: Gsap, root: HTMLElement) {
  const deck = root.querySelector<HTMLElement>('[data-motion="deck"]')
  if (!deck) return
  const slips = gsap.utils.toArray<HTMLElement>('[data-slip]', deck)
  // GSAP folds the CSS `rotate` into its own transform, so the deal ends on the
  // resting tilt and clearing the inline styles afterwards changes nothing.
  const resting = slips.map(slip => Number.parseFloat(getComputedStyle(slip).getPropertyValue('--r')) || 0)

  const timeline = gsap.timeline({
    delay: .1,
    onComplete: () => {
      deck.classList.add('is-dealt')
      gsap.set(slips, { clearProps: 'opacity,transform,translate,rotate,scale' })
    },
  })

  timeline.fromTo(slips,
    { opacity: 0, y: 96, rotation: index => (resting[index] ?? 0) + (DEAL_TILT[index] ?? 0) },
    { opacity: 1, y: 0, rotation: index => resting[index] ?? 0, duration: 1.1, ease: 'expo.out', stagger: .14 })

  const wording = deck.querySelector('[data-ntd-output]')
  if (wording) {
    timeline.fromTo(wording,
      { clipPath: 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0)', duration: .9, ease: 'power3.inOut', clearProps: 'clipPath' }, .45)
  }

  const breakDays = deck.querySelectorAll('[data-break]')
  if (breakDays.length) {
    timeline.from(breakDays, { scale: .2, opacity: 0, duration: .45, ease: 'back.out(2.2)', stagger: .05, clearProps: 'opacity,transform' }, .7)
  }

  const reading = deck.querySelector<HTMLElement>('[data-count-to]')
  if (reading) countUp(timeline, reading, 15, .6)
}

function demoTimeline(gsap: Gsap, demo: HTMLElement | SVGElement) {
  const timeline = gsap.timeline({ paused: true })

  switch (demo.dataset.demo) {
    case 'cutout': {
      const clip = demo.querySelector('[data-scene-clip]')
      const steps = demo.querySelectorAll('[data-step]')
      if (clip) timeline.fromTo(clip, { attr: { x: 0 } }, { attr: { x: 240 }, duration: 1.2, ease: 'power3.inOut', delay: .2 })
      timeline.from(demo.querySelector('[data-png-tag]'), { opacity: 0, scale: .4, transformOrigin: '50% 50%', duration: .35, ease: 'back.out(2.5)' }, '>-.1')
      timeline.call(() => steps.forEach(step => step.classList.remove('is-lit')), [], 0)
      steps.forEach((step, index) => timeline.call(() => step.classList.add('is-lit'), [], 1.1 + index * .32))
      return timeline
    }
    case 'signature': {
      const stroke = demo.querySelector('[data-signature-stroke]')
      if (!stroke) return null
      return timeline.fromTo(stroke, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.8, ease: 'power2.inOut', delay: .15 })
    }
    case 'bmi': {
      const marker = demo.querySelector<HTMLElement>('[data-bmi-marker]')
      if (!marker) return null
      const position = Number(marker.style.getPropertyValue('--pos'))
      // The marker rests at its CSS position; it travels there from the scale's start on transform alone.
      timeline.from(marker, { x: () => -position * (marker.parentElement?.clientWidth ?? 0), duration: 1.4, ease: 'expo.out', clearProps: 'transform,translate' })
      return timeline
    }
    case 'wheel': {
      const wheel = demo.querySelector<SVGElement>('[data-wheel]')
      const won = demo.querySelector('[data-wheel-won]')
      const result = demo.querySelector('[data-wheel-result]')
      if (!wheel) return null
      // The shared wheel turns through a CSS variable (#106), so the spin tweens that and ends on the rendered angle.
      const resting = Number.parseFloat(wheel.style.getPropertyValue('--wheel-rotation')) || 0
      timeline.fromTo(wheel, { '--wheel-rotation': `${resting - 1440}deg` }, { '--wheel-rotation': `${resting}deg`, duration: 3, ease: 'power4.out' })
      // As on the tool, the drawn slice only stands out once the wheel has stopped.
      if (won) timeline.fromTo(won, { '--wheel-won': 0 }, { '--wheel-won': 1, duration: .35, ease: 'back.out(2)' }, '-=.35')
      if (result) timeline.fromTo(result, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .35, ease: 'back.out(2)' }, '<')
      return timeline
    }
    default:
      return null
  }
}

/** Counts a reading up from a starting value and always ends on the exact text the page rendered. */
function countUp(timeline: ReturnType<Gsap['timeline']>, element: HTMLElement, from: number, at: number) {
  const target = element.dataset.countTo ?? element.textContent ?? ''
  const digits = target.split('.')[1]?.length ?? 0
  const counter = { value: from }
  timeline.fromTo(counter, { value: from }, {
    value: Number(target),
    duration: 1.2,
    ease: 'expo.out',
    onUpdate: () => { element.textContent = counter.value.toFixed(digits) },
    onComplete: () => { element.textContent = target },
  }, at)
}
