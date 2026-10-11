import { strict as assert } from 'node:assert'
import { test } from 'node:test'

test('八格车牌输入支持分位输入、修改、退格和回填', async t => {
  let definition: any
  const runtime = globalThis as any
  runtime.Component = (component: unknown) => { definition = component }
  runtime.wx = { hideKeyboard() {} }
  await import('../miniprogram/components/plate-input/plate-input')
  const create = (value = '') => {
    const changes: string[] = []
    const component = {
      ...definition.methods, data: { ...structuredClone(definition.data), value },
      setData(patch: object) { Object.assign(this.data, patch) },
      triggerEvent(name: string, detail: { value: string }) { if (name === 'change') changes.push(detail.value) }
    }
    definition.observers.value.call(component, value)
    return { component, changes }
  }
  const event = (dataset: object) => ({ currentTarget: { dataset } })
  const type = (component: any, plate: string) => [...plate].forEach(key => component.onKey(event({ key })))

  await t.test('首位只接受省份、第二位只接受字母，完成后返回完整车牌', () => {
    const { component, changes } = create()
    component.onOpen()
    component.onKey(event({ key: '1' }))
    assert.equal(component.data.plate, '')
    component.onKey(event({ key: '粤' }))
    assert.equal(component.data.activeIndex, 1)
    component.onKey(event({ key: '1' }))
    assert.equal(component.data.plate, '粤')
    type(component, 'B12345')
    assert.equal(component.data.plate, '粤B12345')
    assert.equal(changes.at(-1), '粤B12345')
    component.onDone()
    assert.equal(component.data.open, false)
  })
  await t.test('逐格覆盖、末位退格、清空和不完整时不能完成', () => {
    const { component } = create('粤b·12345')
    component.onOpen()
    component.onSelectSlot(event({ index: 1 }))
    component.onKey(event({ key: 'C' }))
    assert.equal(component.data.plate, '粤C12345')
    component.onSelectSlot(event({ index: 6 }))
    component.onDelete()
    assert.equal(component.data.plate, '粤C1234')
    assert.equal(component.data.activeIndex, 6)
    component.onDone()
    assert.equal(component.data.open, true)
    component.onClear()
    assert.equal(component.data.plate, '')
    assert.equal(component.data.activeIndex, 0)
  })
  await t.test('始终展示八格，七位即可完成，第八格可继续输入新能源车牌', () => {
    const { component, changes } = create()
    assert.equal(component.data.slots.length, 8)
    component.onOpen()
    type(component, '沪AD1234')
    assert.equal(component.data.complete, true)
    assert.equal(component.data.activeIndex, 7)
    component.onKey(event({ key: '5' }))
    assert.equal(component.data.slots.length, 8)
    assert.equal(component.data.plate, '沪AD12345')
    assert.equal(changes.at(-1), '沪AD12345')
    component.onDelete()
    assert.equal(component.data.complete, true)
    assert.equal(component.data.slots.length, 8)
  })
  await t.test('点击指定方块进入对应位置，父级回传不会打断光标', () => {
    const { component } = create('沪a d12345')
    assert.equal(component.data.slots.length, 8)
    component.onOpen(event({ index: 2 }))
    assert.equal(component.data.activeIndex, 2)
    definition.observers.value.call(component, '沪AD12345')
    assert.equal(component.data.activeIndex, 2)
    component.onKey(event({ key: 'F' }))
    assert.equal(component.data.plate, '沪AF12345')
    component.onClose()
    component.onOpen()
    assert.equal(component.data.plate, '沪AF12345')
  })
  await t.test('独立键盘确认后由页面关闭，取消再次打开恢复初始值', () => {
    const { component } = create('粤B12345')
    const events: Array<{ name: string; value?: string }> = []
    component.triggerEvent = (name: string, detail?: { value: string }) => events.push({ name, value: detail?.value })
    component.data.keyboardOnly = true
    definition.observers.visible.call(component, true)
    assert.equal(component.data.open, true)
    component.onSelectSlot(event({ index: 1 }))
    component.onKey(event({ key: 'C' }))
    component.onDone()
    assert.equal(events.at(-1)?.name, 'confirm')
    assert.equal(events.at(-1)?.value, '粤C12345')
    assert.equal(component.data.open, true)
    component.onClose()
    assert.equal(events.at(-1)?.name, 'cancel')
    definition.observers.visible.call(component, true)
    assert.equal(component.data.plate, '粤B12345')
  })
})
