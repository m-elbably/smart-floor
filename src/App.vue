<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import type { Database } from 'sql.js'
import { useColorMode } from '@vueuse/core'
import { openDb, recover, DbOpenError, onSaveState } from './db/sqlite'
import * as repo from './db/repo'
import { store, loadSettings, refreshProjects } from './editor/store'
import HomeView from './ui/HomeView.vue'
import EditorView from './ui/EditorView.vue'
import SettingsModal from './ui/SettingsModal.vue'

const status = ref<'loading' | 'ready' | 'corrupt' | 'failed'>('loading')
const failure = ref<DbOpenError | null>(null)
const settingsOpen = ref(false)
onSaveState(s => (store.saveState = s))

// Theme setting drives Nuxt UI's color mode [FR-101]
const mode = useColorMode({ emitAuto: true })
watch(() => store.settings.theme, t => (mode.store.value = t === 'system' ? 'auto' : t), { immediate: true })

function ready(db: Database) {
  loadSettings()
  refreshProjects()
  status.value = 'ready'
  // Dev console access for manual verification: sf.store, sf.repo.listProjects(sf.db)
  if (import.meta.env.DEV) Object.assign(window, { sf: { db, repo, store } })
}

async function boot(fn: () => Promise<Database>) {
  status.value = 'loading'
  try {
    ready(await fn())
  } catch (e) {
    console.error(e)
    if (e instanceof DbOpenError) {
      failure.value = e
      status.value = 'corrupt'
    } else status.value = 'failed'
  }
}

onMounted(() => boot(openDb))
</script>

<template>
  <UApp>
    <template v-if="status === 'ready'">
      <EditorView v-if="store.data" @settings="settingsOpen = true" />
      <HomeView v-else @settings="settingsOpen = true" />
      <SettingsModal v-model:open="settingsOpen" />
    </template>
    <main v-else class="h-full grid place-items-center">
      <p v-if="status === 'loading'" class="text-muted">Loading…</p>
      <p v-else-if="status === 'failed'" class="text-error">Could not start the database. See the log for details.</p>
    </main>

    <!-- Corrupt database recovery [FR-122] -->
    <UModal :open="status === 'corrupt'" title="Your data file could not be opened" :dismissible="false" :close="false">
      <template #body>
        <p class="mb-4 text-sm text-muted">
          The file may be damaged. It will be kept aside (renamed to <code>.corrupt-…</code>), not deleted.
          Restore a daily backup or start with an empty database.
        </p>
        <div class="flex flex-col gap-2">
          <UButton
            v-for="(b, i) in failure?.backups"
            :key="b"
            icon="i-lucide-history"
            variant="soft"
            :label="`Restore backup ${i + 1}${i === 0 ? ' (newest)' : ''}`"
            @click="boot(() => recover(b))"
          />
          <UButton icon="i-lucide-file-plus" color="neutral" variant="outline" label="Start fresh" @click="boot(() => recover(null))" />
        </div>
      </template>
    </UModal>
  </UApp>
</template>
