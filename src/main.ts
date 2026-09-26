import './app.css'
import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import { initNeutralino, onWindowClose } from './neu'
import { save } from './db/sqlite'

initNeutralino()
onWindowClose(save) // flush any pending autosave before exit [FR-123]

createApp(App).use(ui).mount('#app')
