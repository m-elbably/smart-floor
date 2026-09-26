<script setup lang="ts">
// App settings: units, theme, grid and default dimensions [FR-100..102]
import { store, saveSettings } from '@/editor/store'
import LengthInput from './LengthInput.vue'

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal v-model:open="open" title="Settings">
    <template #body>
      <div class="flex flex-col gap-5">
        <UFormField label="Units" description="Values are always stored in metres; this changes display and input.">
          <URadioGroup
            :model-value="store.settings.units"
            orientation="horizontal"
            :items="[{ label: 'Metric (m, cm)', value: 'metric' }, { label: 'Imperial (ft, in)', value: 'imperial' }]"
            @update:model-value="(v: unknown) => saveSettings({ units: v as 'metric' | 'imperial' })"
          />
        </UFormField>
        <UFormField label="Theme">
          <URadioGroup
            :model-value="store.settings.theme"
            orientation="horizontal"
            :items="[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]"
            @update:model-value="(v: unknown) => saveSettings({ theme: v as 'system' | 'light' | 'dark' })"
          />
        </UFormField>
        <USeparator label="Defaults for new elements" />
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Grid size">
            <LengthInput :model-value="store.settings.grid" :min="0.01" :max="5" @update:model-value="v => saveSettings({ grid: v })" />
          </UFormField>
          <UFormField label="Floor height">
            <LengthInput :model-value="store.settings.floorHeight" :min="1.8" :max="10" @update:model-value="v => saveSettings({ floorHeight: v })" />
          </UFormField>
          <UFormField label="Slab thickness">
            <LengthInput :model-value="store.settings.slab" :min="0" :max="1" @update:model-value="v => saveSettings({ slab: v })" />
          </UFormField>
          <UFormField label="Interior wall">
            <LengthInput :model-value="store.settings.wallInterior" :min="0.05" :max="1" @update:model-value="v => saveSettings({ wallInterior: v })" />
          </UFormField>
          <UFormField label="Exterior wall">
            <LengthInput :model-value="store.settings.wallExterior" :min="0.05" :max="1" @update:model-value="v => saveSettings({ wallExterior: v })" />
          </UFormField>
        </div>
      </div>
    </template>
  </UModal>
</template>
