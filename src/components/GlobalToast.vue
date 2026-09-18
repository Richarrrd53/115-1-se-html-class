<script setup lang="ts">
defineProps<{
  show: boolean
  message: string
  type?: 'success' | 'info' | 'warning' | 'error'
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <transition name="toast-slide">
    <div v-if="show" class="global-toast-bar" :class="[`toast-${type || 'info'}`]" role="status" aria-live="polite">
      <div class="toast-icon">
        <svg v-if="type === 'success'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <svg v-else-if="type === 'error'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <svg v-else-if="type === 'warning'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </div>
      <div class="toast-text">{{ message }}</div>
      <button class="toast-close" type="button" @click="emit('close')" aria-label="關閉通知">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </transition>
</template>

<style scoped>
.global-toast-bar {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: var(--backdrop-glass-nav, blur(16px));
  border: 1px solid var(--color-border-default, #e2e8f0);
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-toast, 0 12px 36px rgba(15, 23, 42, 0.12));
  color: var(--color-text-primary, #0f172a);
  font-size: var(--font-size-sm, 0.88rem);
  font-weight: var(--font-weight-medium, 500);
  min-width: 280px;
  max-width: 480px;
}

.toast-success {
  border-left: 4px solid var(--color-status-success, #10b981);
}
.toast-success .toast-icon {
  color: var(--color-status-success, #10b981);
}

.toast-error {
  border-left: 4px solid var(--color-status-error, #ef4444);
}
.toast-error .toast-icon {
  color: var(--color-status-error, #ef4444);
}

.toast-warning {
  border-left: 4px solid var(--color-status-warning, #f59e0b);
}
.toast-warning .toast-icon {
  color: var(--color-status-warning, #f59e0b);
}

.toast-info {
  border-left: 4px solid var(--color-brand-primary, #2563eb);
}
.toast-info .toast-icon {
  color: var(--color-brand-primary, #2563eb);
}

.toast-text {
  flex: 1;
  line-height: 1.4;
}

.toast-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted, #94a3b8);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: var(--radius-xs, 4px);
  transition: all var(--motion-duration-instant, 120ms);
}
.toast-close:hover {
  color: var(--color-text-primary, #0f172a);
  background: var(--slate-100, #f1f5f9);
}

.toast-slide-enter-active {
  transition: all 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-leave-active {
  transition: all 0.22s cubic-bezier(0.4, 0, 1, 1);
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateY(-16px) scale(0.95);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>
