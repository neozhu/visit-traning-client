import { normalizePlate } from '../../models/visit'

const provinces = [...'京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼']
const letters = [...'ABCDEFGHJKLMNPQRSTUVWXYZ']
const characters = [...'0123456789', ...letters]
const slotsFor = (plate: string) => Array.from({ length: 8 }, (_, index) => plate[index] || '')

Component({
  properties: {
    value: { type: String, value: '' },
    invalid: { type: Boolean, value: false },
    label: { type: String, value: '车牌号' },
    keyboardOnly: { type: Boolean, value: false },
    visible: { type: Boolean, value: false },
    message: { type: String, value: '' }
  },
  data: {
    open: false, plate: '', activeIndex: 0,
    slots: slotsFor(''), provinces, letters, characters, complete: false
  },
  observers: {
    visible(visible: boolean) {
      if (!this.data.keyboardOnly) return
      const plate = normalizePlate(this.data.value || '').slice(0, 8)
      this.setData({ open: visible, plate, slots: slotsFor(plate), activeIndex: Math.min(plate.length, 7), complete: this.isComplete(plate) })
      if (visible) wx.hideKeyboard()
    },
    value(value: string) {
      const plate = normalizePlate(value || '').slice(0, 8)
      if (plate === this.data.plate) return
      this.setData({ plate, slots: slotsFor(plate),
        activeIndex: Math.min(plate.length, 7), complete: this.isComplete(plate) })
    }
  },
  pageLifetimes: {
    hide() { this.setData({ open: false }) }
  },
  methods: {
    noop() {},
    isComplete(plate: string) {
      return provinces.includes(plate[0]) && /^[\u4e00-\u9fa5][A-Z][A-Z0-9]{5,6}$/.test(plate)
    },
    updatePlate(plate: string, activeIndex: number) {
      this.setData({ plate, activeIndex, slots: slotsFor(plate), complete: this.isComplete(plate) })
      this.triggerEvent('change', { value: plate })
    },
    onOpen(event?: WechatMiniprogram.BaseEvent) {
      wx.hideKeyboard()
      const index = Number(event?.currentTarget.dataset.index)
      const activeIndex = Number.isInteger(index) && index >= 0 && index < 8 ? index : 7
      this.setData({ open: true, activeIndex: Math.min(activeIndex, this.data.plate.length) })
    },
    onClose() {
      this.setData({ open: false })
      if (this.data.keyboardOnly) this.triggerEvent('cancel')
    },
    onDone() {
      if (!this.data.complete) return
      if (this.data.keyboardOnly) this.triggerEvent('confirm', { value: this.data.plate })
      else this.onClose()
    },
    onSelectSlot(event: WechatMiniprogram.BaseEvent) {
      const index = Number(event.currentTarget.dataset.index)
      if (!Number.isInteger(index) || index < 0 || index >= 8) return
      this.setData({ activeIndex: Math.min(index, this.data.plate.length) })
    },
    onKey(event: WechatMiniprogram.BaseEvent) {
      const key = event.currentTarget.dataset.key as string
      const { plate, activeIndex } = this.data
      const allowed = activeIndex === 0 ? provinces : activeIndex === 1 ? letters : characters
      if (!allowed.includes(key)) return
      this.updatePlate(plate.slice(0, activeIndex) + key + plate.slice(activeIndex + 1), Math.min(activeIndex + 1, 7))
    },
    onDelete() {
      const { plate, activeIndex } = this.data
      if (!plate.length) return
      // 删除当前格；光标位于空格时，退回上一格。
      const index = Math.min(activeIndex, plate.length - 1)
      this.updatePlate(plate.slice(0, index) + plate.slice(index + 1), index)
    },
    onClear() { this.updatePlate('', 0) }
  }
})
