<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Database } from 'sql.js'
import { openDb, recover, DbOpenError, onSaveState, scheduleSave, type SaveState } from './db/sqlite'
import * as repo from './db/repo'

const status = ref<'loading' | 'ready' | 'corrupt' | 'failed'>('loading')
const failure = ref<DbOpenError | null>(null)
const saveState = ref<SaveState>('saved')
onSaveState(s => (saveState.value = s))

function ready(db: Database) {
  status.value = 'ready'
  // Dev console access for manual verification: sf.repo.listProjects(sf.db)
  if (import.meta.env.DEV) Object.assign(window, { sf: { db, repo, scheduleSave } })
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
    <main class="h-full flex flex-col items-center justify-center gap-4">
      <h1 class="text-3xl font-semibold">Smart Floor</h1>
      <p v-if="status === 'loading'" class="text-muted">Loading…</p>
      <p v-else-if="status === 'failed'" class="text-error">Could not start the database. See the log for details.</p>
      <p v-else-if="status === 'ready'" class="text-muted">Database ready · {{ saveState }}</p>
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
