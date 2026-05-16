import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import './custom.css'
import Banner from './Banner.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-top': () => h(Banner),
    })
  },
}
