import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { vDynamicMask } from './utils/dynamicMask'

const app = createApp(App)
app.directive('dynamic-mask', vDynamicMask)
app.mount('#app')
