<script setup lang="ts">
import { store } from '@/editor/store'

function answer(yes: boolean) {
  const c = store.ui.confirm
  store.ui.confirm = null
  if (c) (yes ? c.onYes : c.onNo)()
}
</script>

<template>
  <UModal :open="!!store.ui.confirm" :title="store.ui.confirm?.title" :description="store.ui.confirm?.text" @update:open="(o: boolean) => !o && (store.ui.confirm = null)">
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="outline" :label="store.ui.confirm?.no" @click="answer(false)" />
        <UButton :label="store.ui.confirm?.yes" @click="answer(true)" />
      </div>
    </template>
  </UModal>
</template>
