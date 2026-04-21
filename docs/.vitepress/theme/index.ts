import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import DevBanner from './DevBanner.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-top': () => h(DevBanner),
    })
  },
}
