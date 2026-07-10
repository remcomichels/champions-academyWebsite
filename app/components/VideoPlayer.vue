<template>
  <div
    ref="containerEl"
    class="video-player"
    :class="{
      'is-playing': isPlaying,
      'is-controls-visible': controlsVisible,
      'is-no-controls': !showControls,
      'is-fullscreen': isFullscreen,
    }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @mousemove="onMouseMove"
    @touchstart.passive="onTouchStart"
  >
    <video
      ref="videoEl"
      :poster="poster"
      :autoplay="autoplay"
      :muted="autoplay || isMuted"
      :loop="loop"
      :aria-hidden="autoplay"
      playsinline
      class="video-player__video"
      @loadedmetadata="onLoadedMetadata"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="isPlaying = false"
      @click="togglePlay"
    />

    <!-- All custom UI -->
    <div v-if="showControls" class="video-player__ui">
      <!-- Gradient veil -->
      <div class="video-player__veil" />

      <!-- Control bar -->
      <div class="video-player__controls">
        <div class="video-player__controls-left">
          <!-- Play / Pause -->
          <button
            class="video-player__btn video-player__btn--play"
            :aria-label="isPlaying ? 'Pause' : 'Play'"
            @click.stop="togglePlay"
          >
            <transition name="vp-icon" mode="out-in">
              <svg v-if="!isPlaying" key="play" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <svg v-else key="pause" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </transition>
          </button>

          <!-- Time -->
          <div class="video-player__time" aria-label="Playback time">
            <span class="video-player__time-current">{{ formatTime(currentTime) }}</span>
            <span class="video-player__time-sep" aria-hidden="true"/>
            <span class="video-player__time-total">{{ formatTime(duration) }}</span>
          </div>
        </div>

        <div class="video-player__controls-right">
          <!-- Volume -->
          <div class="video-player__volume">
            <button
              class="video-player__btn"
              :aria-label="isMuted ? 'Unmute' : 'Mute'"
              @click="toggleMute"
            >
              <transition name="vp-icon" mode="out-in">
                <svg v-if="isMuted || volume === 0" key="muted" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
                <svg v-else-if="volume < 0.5" key="low" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                </svg>
                <svg v-else key="high" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              </transition>
            </button>
            <div class="video-player__volume-track">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="isMuted ? 0 : volume"
                :style="{ '--vol-pct': `${(isMuted ? 0 : volume) * 100}%` }"
                class="video-player__volume-slider"
                aria-label="Volume"
                @input="onVolumeChange"
              >
            </div>
          </div>

          <!-- Fullscreen -->
          <button
            class="video-player__btn"
            :aria-label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
            @click="toggleFullscreen"
          >
            <transition name="vp-icon" mode="out-in">
              <svg v-if="!isFullscreen" key="enter" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
              <svg v-else key="exit" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            </transition>
          </button>
        </div>
      </div>

      <!-- Progress bar — padded, not flush to edges -->
      <div
        ref="progressEl"
        class="video-player__progress"
        role="slider"
        :aria-valuenow="Math.round(progressPercent)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Playback progress: ${formatTime(currentTime)}`"
        @mousedown.prevent="startScrub"
        @touchstart.prevent="startScrub"
      >
        <div class="video-player__progress-track">
          <div
            class="video-player__progress-fill"
            :style="{ transform: `scaleX(${progressPercent / 100})` }"
          />
        </div>
        <div
          class="video-player__progress-thumb"
          :style="{ left: `calc(16px + ${progressPercent / 100} * (100% - 32px))` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import Hls from 'hls.js'

const props = defineProps({
  videoId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: '',
  },
  autoplay: {
    type: Boolean,
    default: false,
  },
  loop: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
  poster: {
    type: String,
    default: '',
  },
})

const config = useRuntimeConfig()
const containerEl = ref(null)
const videoEl = ref(null)
const progressEl = ref(null)

// ── State ──────────────────────────────────────────────────────────────────
const isPlaying = ref(false)
const isMuted = ref(props.autoplay)
const volume = ref(1)
const currentTime = ref(0)
const duration = ref(0)
const isFullscreen = ref(false)
const controlsVisible = ref(true)
const isScrubbing = ref(false)

// ── Computed ───────────────────────────────────────────────────────────────
const progressPercent = computed(() => {
  if (!duration.value) return 0
  return Math.min(100, (currentTime.value / duration.value) * 100)
})

const hlsUrl = computed(
  () => `https://${config.public.bunnyStreamHostname}/${props.videoId}/playlist.m3u8`
)

// ── Controls auto-hide ─────────────────────────────────────────────────────
let hideTimer = null

const scheduleHide = () => {
  clearTimeout(hideTimer)
  if (isPlaying.value && !isScrubbing.value) {
    hideTimer = setTimeout(() => {
      controlsVisible.value = false
    }, 3000)
  }
}

const onMouseEnter = () => {
  controlsVisible.value = true
  clearTimeout(hideTimer)
}

const onMouseLeave = () => {
  if (isPlaying.value && !isScrubbing.value) {
    hideTimer = setTimeout(() => {
      controlsVisible.value = false
    }, 200)
  }
}

const onMouseMove = () => {
  controlsVisible.value = true
  scheduleHide()
}

const onTouchStart = () => {
  controlsVisible.value = true
  scheduleHide()
}

// ── Playback ───────────────────────────────────────────────────────────────
const togglePlay = () => {
  const video = videoEl.value
  if (!video) return
  if (video.paused) {
    video.play()
  } else {
    video.pause()
  }
}

// ── Volume ─────────────────────────────────────────────────────────────────
const toggleMute = () => {
  isMuted.value = !isMuted.value
  if (videoEl.value) videoEl.value.muted = isMuted.value
}

const onVolumeChange = (e) => {
  const val = parseFloat(e.target.value)
  volume.value = val
  if (videoEl.value) {
    videoEl.value.volume = val
    videoEl.value.muted = val === 0
    isMuted.value = val === 0
  }
}

// ── Fullscreen ─────────────────────────────────────────────────────────────
const toggleFullscreen = () => {
  const el = containerEl.value
  if (!el) return
  if (!document.fullscreenElement) {
    el.requestFullscreen?.()
    isFullscreen.value = true
  } else {
    document.exitFullscreen?.()
    isFullscreen.value = false
  }
}

// ── Time & progress ────────────────────────────────────────────────────────
let _rafId = null

const _tickProgress = () => {
  if (!isScrubbing.value && videoEl.value) {
    currentTime.value = videoEl.value.currentTime
  }
  _rafId = requestAnimationFrame(_tickProgress)
}

const onLoadedMetadata = () => {
  duration.value = videoEl.value?.duration || 0
}

const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX

const scrubTo = (clientX) => {
  const trackEl = progressEl.value?.querySelector('.video-player__progress-track')
  const video = videoEl.value
  if (!trackEl || !video) return
  const rect = trackEl.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  currentTime.value = ratio * duration.value
  video.currentTime = currentTime.value
}

const startScrub = (e) => {
  isScrubbing.value = true
  scrubTo(getClientX(e))

  const onMove = (ev) => scrubTo(getClientX(ev))
  const onUp = () => {
    isScrubbing.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onUp)
}

// ── Helpers ────────────────────────────────────────────────────────────────
const formatTime = (secs) => {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  const video = videoEl.value
  if (!video) return

  if (Hls.isSupported()) {
    const hls = new Hls()
    hls.loadSource(hlsUrl.value)
    hls.attachMedia(video)
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = hlsUrl.value
  }

  video.volume = volume.value

  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })

  _rafId = requestAnimationFrame(_tickProgress)
})

onUnmounted(() => {
  clearTimeout(hideTimer)
  cancelAnimationFrame(_rafId)
})
</script>