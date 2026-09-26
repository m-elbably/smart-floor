<script setup lang="ts">
import { ref } from 'vue'
import { store, activeFloor } from '@/editor/store'
import { format } from '@/editor/units'
import TopBar from './TopBar.vue'
import FloorsModal from './FloorsModal.vue'

const emit = defineEmits<{ settings: [] }>()
const floorsOpen = ref(false)

const saveLabel = { saved: 'Saved', dirty: 'Unsaved', saving: 'Saving…', error: 'Save failed' } as const
const saveIcon = { saved: 'i-lucide-check', dirty: 'i-lucide-circle-dot', saving: 'i-lucide-loader', error: 'i-lucide-triangle-alert' } as const
</script>

<template>
  <div class="h-full flex flex-col">
    <TopBar @floors="floorsOpen = true" @settings="emit('settings')" />

    <!-- Viewport arrives in M3 -->
    <main class="flex-1 grid place-items-center bg-muted">
      <div v-if="activeFloor" class="text-center text-muted">
        <UIcon name="i-lucide-layers" class="size-10 mb-2" />
        <p class="text-lg text-default">{{ activeFloor.name }}</p>
        <p class="text-sm">
          Level {{ activeFloor.level }} · elevation {{ format(activeFloor.elevation, store.settings.units) }} ·
          height {{ format(activeFloor.height, store.settings.units) }}
        </p>
      </div>
    </main>

    <footer class="flex items-center gap-4 px-3 h-7 text-xs text-muted border-t border-default bg-default">
      <span>{{ store.settings.units === 'metric' ? 'Metric' : 'Imperial' }}</span>
      <span>Grid {{ format(store.settings.grid, store.settings.units) }}</span>
      <div class="flex-1" />
      <span class="flex items-center gap-1" :class="store.saveState === 'error' && 'text-error'">
        <UIcon :name="saveIcon[store.saveState]" :class="store.saveState === 'saving' && 'animate-spin'" />
        {{ saveLabel[store.saveState] }}
      </span>
    </footer>

    <FloorsModal v-model:open="floorsOpen" />
  </div>
</template>
