<script setup lang="ts">
import { store } from '@/editor/store'
import { setTool } from '@/editor/tools'
import { TOOLS, openCatalog } from '@/editor/shortcuts'
</script>

<template>
  <nav class="flex flex-col gap-1 p-1.5 border-r border-default bg-default" aria-label="Tools">
    <UTooltip v-for="t in TOOLS" :key="t.id" :text="t.label" :kbds="[t.key]" :content="{ side: 'right' }">
      <UButton
        :icon="t.icon"
        :aria-label="t.label"
        :color="store.tool === t.id || (t.id === 'item' && store.catalogOpen) ? 'primary' : 'neutral'"
        :variant="store.tool === t.id || (t.id === 'item' && store.catalogOpen) ? 'soft' : 'ghost'"
        size="lg"
        @click="t.id === 'item' ? (store.catalogOpen ? (store.catalogOpen = false) : openCatalog()) : setTool(t.id)"
      />
    </UTooltip>
  </nav>
</template>
