import './app.css'
import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import { addCollection } from '@iconify/vue'
import lucide from '@iconify-json/lucide/icons.json'
import App from './App.vue'
import { initNeutralino, onWindowClose } from './neu'
import { save } from './db/sqlite'
import { captureThumbnail } from './editor/store'

// Bundle the icon set so Nuxt UI never fetches icons from the network [NFR-03].
// ponytail: whole Lucide set (~600 KB JSON); subset it if bundle size ever matters.
addCollection(lucide)

initNeutralino()
// Before exit: refresh the open project's thumbnail [FR-04], then flush the autosave [FR-123].
onWindowClose(async () => {
  try {
    captureThumbnail()
  } catch (e) {
    console.error(e)
  }
  await save()
})

createApp(App).use(ui).mount('#app')
