import { createApp } from 'vue'
import './style.css'
import EditApp from './EditApp.vue'
import { vDynamicMask } from './utils/dynamicMask'

const app = createApp(EditApp)
app.directive('dynamic-mask', vDynamicMask)
app.mount('#edit-app')
