<script setup>
import { ref, onMounted } from 'vue'

const STORAGE_KEY = 'vesl-banner-dismissed-v2'
const dismissed = ref(false)

onMounted(() => {
  if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true') {
    dismissed.value = true
  }
})

function dismiss() {
  dismissed.value = true
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, 'true')
  }
}
</script>

<template>
  <div v-show="!dismissed" class="vesl-banner" role="region" aria-label="Development notice">
    <span class="vesl-banner-text"
      >::  vesl-nockup beta is currently live</span
    >
    <button class="vesl-banner-close" @click="dismiss" aria-label="Dismiss notice" type="button">
      ×
    </button>
  </div>
</template>

<style scoped>
.vesl-banner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.55rem 3rem;
  background: linear-gradient(
    135deg,
    rgba(0, 255, 163, 0.12),
    rgba(0, 0, 0, 0.4) 50%,
    rgba(0, 255, 163, 0.12)
  );
  border-bottom: 1px solid rgba(0, 255, 163, 0.4);
  color: #00ffa3;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  font-size: 0.82rem;
  line-height: 1.45;
  text-align: center;
}

.vesl-banner-text {
  max-width: 90ch;
  word-break: break-word;
}

.vesl-banner-close {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: 1px solid rgba(0, 255, 163, 0.4);
  color: #00ffa3;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.05rem 0.45rem;
  font-family: inherit;
}

.vesl-banner-close:hover,
.vesl-banner-close:focus-visible {
  background: rgba(0, 255, 163, 0.18);
  outline: none;
}

@media (max-width: 640px) {
  .vesl-banner {
    padding: 0.5rem 2.4rem;
    font-size: 0.75rem;
  }
}
</style>
