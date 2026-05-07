<template>
  <div class="dev-banner" role="note">
    <span class="dev-banner__tag">Preview</span>
    <span class="dev-banner__text">
      Active development. Docs reflect the <strong>hull-rag demo</strong>; full
      docs at release.
    </span>
  </div>
</template>

<style scoped>
.dev-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 16px;
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
  background: linear-gradient(
    90deg,
    rgba(0, 255, 163, 0.08),
    rgba(0, 255, 163, 0.18),
    rgba(0, 255, 163, 0.08)
  );
  border-bottom: 1px solid rgba(0, 255, 163, 0.35);
  color: var(--vp-c-text-1);
}

.dev-banner__tag {
  flex-shrink: 0;
  padding: 2px 8px;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #00ffa3;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(0, 255, 163, 0.5);
  border-radius: 4px;
}

.dev-banner__text strong {
  color: #00ffa3;
  font-weight: 600;
}

@media (max-width: 640px) {
  .dev-banner {
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    padding: 8px 12px;
  }
}
</style>
