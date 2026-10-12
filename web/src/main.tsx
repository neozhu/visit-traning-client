import { createRoot } from 'react-dom/client'
import { unstableSetRender } from 'antd-mobile'
import { App } from './App'
import './styles.css'

// Ant Design Mobile's imperative dialogs/toasts use its public React 19 renderer hook.
const roots = new WeakMap<Element | DocumentFragment, ReturnType<typeof createRoot>>()
unstableSetRender((node, container) => {
  let root = roots.get(container)
  if (!root) { root = createRoot(container); roots.set(container, root) }
  root.render(node)
  return async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    root.unmount()
    roots.delete(container)
  }
})

createRoot(document.getElementById('root')!).render(<App />)
