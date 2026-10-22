import { t, translateMessage } from '../i18n'
import { useState } from 'react'
import { Button, Popup } from 'antd-mobile'
import { normalizePlate, validPlate } from '../domain/store'
import { Icon } from './UI'

const provinces = '京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼'.split('')
const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('')

export function PlatePicker({ value, title = t('填写车牌'), onConfirm, onClose }: { value: string; title?: string; onConfirm: (value: string) => void; onClose: () => void }) {
  const [plate, setPlate] = useState(normalizePlate(value))
  const [cursor, setCursor] = useState(Math.min(normalizePlate(value).length, 7))
  const [error, setError] = useState('')
  const keys = cursor === 0 ? provinces : cursor === 1 ? letters : [...'0123456789'.split(''), ...letters]
  function input(key: string) {
    const chars = plate.split('')
    chars[cursor] = key
    setPlate(chars.join(''))
    setCursor(Math.min(cursor + 1, 7))
    setError('')
  }
  function confirm() {
    if (!validPlate(plate)) { setError('请填写完整的七位或八位有效车牌'); return }
    try { onConfirm(normalizePlate(plate)) } catch (issue) { setError(issue instanceof Error ? issue.message : t('车牌保存失败')) }
  }
  return <Popup visible onMaskClick={onClose} bodyStyle={{ borderRadius: '20px 20px 0 0', maxHeight: '90dvh', overflowY: 'auto' }}>
    <div className="plate-picker"><div className="sheet-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label={t('取消车牌编辑')} onClick={onClose}><Icon name="close" /></button></div>
      <div className="plate-cells">{Array.from({ length: 8 }, (_, index) => <button key={index} type="button" aria-label={t('车牌第{0}位', { 0: index + 1 })} className={`plate-cell ${index === cursor ? 'active' : ''} ${index === 7 ? 'new-energy' : ''}`} onClick={() => setCursor(Math.min(index, plate.length))}>{plate[index] || (index === 7 ? '+' : '')}</button>)}</div>
      <p className="muted small">{t('七位车牌可直接确认，第八位用于新能源车牌')}</p>
      {error && <p className="field-error" role="alert">{translateMessage(error)}</p>}
      <div className="plate-keys">{keys.map(key => <button type="button" key={key} onClick={() => input(key)}>{key}</button>)}</div>
      <div className="flex gap-2 my-3"><Button className="flex-1" onClick={() => { setPlate(''); setCursor(0); setError('') }}>{t('清空')}</Button><Button className="flex-1" onClick={() => { const chars = plate.split(''); const index = plate[cursor] ? cursor : Math.max(0, cursor - 1); chars.splice(index, 1); setPlate(chars.join('')); setCursor(index) }}>{t('退格')}</Button><Button className="flex-[2]" color="primary" onClick={confirm}>{t('确认车牌')}</Button></div>
    </div>
  </Popup>
}
