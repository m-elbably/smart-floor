<script setup lang="ts">
// Areas per floor and for the project, plus counts (FR-74).
import { computed } from 'vue'
import { store } from '@/editor/store'
import { summary } from '@/editor/summary'
import { formatArea } from '@/editor/units'

const s = computed(() => (store.data ? summary(store.data, store.settings) : null))
const a = (m2: number) => formatArea(m2, store.settings.units)
</script>

<template>
  <USlideover v-model:open="store.ui.summary" title="Areas & summary" description="Gross area is inside the outer wall faces; net area is the rooms." :overlay="false" side="right">
    <template #body>
      <div v-if="s" class="flex flex-col gap-5 text-sm">
        <section class="grid grid-cols-2 gap-3">
          <div class="rounded-lg border border-default p-3">
            <p class="text-muted text-xs">Total gross</p>
            <p class="text-lg font-semibold tabular-nums text-highlighted">{{ a(s.gross) }}</p>
          </div>
          <div class="rounded-lg border border-default p-3">
            <p class="text-muted text-xs">Total net (rooms)</p>
            <p class="text-lg font-semibold tabular-nums text-highlighted">{{ a(s.net) }}</p>
          </div>
        </section>

        <section class="flex flex-wrap gap-2">
          <UBadge color="neutral" variant="subtle" icon="i-lucide-door-open">{{ s.doors }} doors</UBadge>
          <UBadge color="neutral" variant="subtle" icon="i-lucide-app-window">{{ s.windows }} windows</UBadge>
          <UBadge color="neutral" variant="subtle" icon="i-lucide-armchair">{{ s.items }} items</UBadge>
          <UBadge color="neutral" variant="subtle" icon="i-lucide-footprints">{{ s.stairs }} stairs</UBadge>
          <UBadge v-if="s.site !== null" color="warning" variant="subtle" icon="i-lucide-land-plot">Site {{ a(s.site) }}</UBadge>
        </section>

        <section v-for="f in s.floors" :key="f.id">
          <header class="flex items-baseline justify-between border-b border-default pb-1 mb-1">
            <button class="font-semibold text-highlighted hover:underline" @click="store.activeFloorId = f.id">{{ f.name }}</button>
            <span class="text-xs text-muted tabular-nums">gross {{ a(f.gross) }} · net {{ a(f.net) }}</span>
          </header>
          <p v-if="!f.rooms.length" class="text-muted text-xs">No rooms yet.</p>
          <ul>
            <li v-for="r in f.rooms" :key="r.id">
              <button
                class="w-full flex justify-between py-0.5 px-1 rounded hover:bg-elevated"
                @click="((store.activeFloorId = f.id), (store.selection = [r.id]))"
              >
                <span>{{ r.name }}</span>
                <span class="tabular-nums text-muted">{{ a(r.area) }}</span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </USlideover>
</template>
