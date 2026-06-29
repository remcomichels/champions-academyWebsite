import type { Ref } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ─────────────────────────────────────────────────────────────────────────────
// useVideoScrub
//
// Scrub a video's playback with scroll position — the element's scroll progress
// maps straight onto the video's currentTime (Bunny/hls infra can feed the
// <video>; this only drives the frame). No-op under reduced motion (the video
// sits on its first frame).
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VideoScrubOptions {
  /** Attribute marking the scrubbed element/video. Default: 'data-video-scrub'. */
  attribute?: string
  /** ScrollTrigger start. Default: 'top bottom'. */
  start?: string
  /** ScrollTrigger end. Default: 'bottom top'. */
  end?: string
  /** Scrub smoothing — true = locked, number = seconds of lag. Default: true. */
  scrub?: boolean | number
}

interface UseVideoScrubReturn {
  initVideoScrub: () => void
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scrub a video's playback with scroll position — the element's scroll progress
 * maps straight onto the video's currentTime. Put [data-video-scrub] on the
 * <video> or a wrapper containing one. The Bunny Stream / hls.js infra in this
 * boilerplate can feed the <video>; this composable only drives currentTime.
 *
 * Under reduced motion it does nothing — the video sits on its first frame.
 *
 * @param root  Optional ref to scope the query to one component instance.
 */
export function useVideoScrub(
  root?: Ref<HTMLElement | null>,
  options: VideoScrubOptions = {},
): UseVideoScrubReturn {
  const {
    attribute = 'data-video-scrub',
    start = 'top bottom',
    end = 'bottom top',
    scrub = true,
  } = options

  const triggers: ScrollTrigger[] = []
  const cleanups: Array<() => void> = []
  const { reduced } = useReducedMotion()

  function setup(trigger: HTMLElement, video: HTMLVideoElement): void {
    // We own playback — keep it paused and silent; scroll drives the frame.
    video.pause()
    video.muted = true

    const st = ScrollTrigger.create({
      trigger,
      start,
      end,
      scrub,
      onUpdate(self) {
        if (video.duration) video.currentTime = self.progress * video.duration
      },
    })
    triggers.push(st)
  }

  function initVideoScrub(): void {
    if (reduced.value) return // leave the video on its first frame / poster

    const scope: ParentNode = root?.value ?? document

    scope.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((el) => {
      if (el.dataset.videoScrubInitialized) return
      el.dataset.videoScrubInitialized = 'true'

      const video = (el.tagName === 'VIDEO' ? el : el.querySelector('video')) as HTMLVideoElement | null
      if (!video) return

      // Need the duration before we can map progress → currentTime.
      if (video.readyState >= 1 /* HAVE_METADATA */) {
        setup(el, video)
      } else {
        const onMeta = () => setup(el, video)
        video.addEventListener('loadedmetadata', onMeta, { once: true })
        cleanups.push(() => video.removeEventListener('loadedmetadata', onMeta))
      }
    })
  }

  function destroy(): void {
    triggers.forEach((t) => t.kill())
    triggers.length = 0
    cleanups.forEach((fn) => fn())
    cleanups.length = 0
  }

  return { initVideoScrub, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed.

<script setup lang="ts">
const root = useTemplateRef<HTMLElement>('root')
const { initVideoScrub, destroy } = useVideoScrub(root)
onMounted(() => initVideoScrub())
onUnmounted(() => destroy())
</script>

<template>
  <div ref="root">
    <!-- muted + playsinline + preload so frames are ready to scrub -->
    <video data-video-scrub src="/clip.mp4" muted playsinline preload="auto" />
  </div>
</template>

NOTES
  • To scrub a tall section in place, wrap the video in a pinned container and
    point start/end at that wrapper (add a ScrollTrigger pin on it).
  • Frame-accurate scrubbing wants a keyframe-dense encode; otherwise seeking
    snaps to the nearest keyframe.
──────────────────────────────────────────────────────────────────────
*/
