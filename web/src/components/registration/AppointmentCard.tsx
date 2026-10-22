import { t } from '../../i18n'
import { useState } from 'react'
import { DatePicker, Picker } from 'antd-mobile'
import { TIME_SLOTS, today } from '../../domain/store'
import { Section } from '../UI'
import { RegistrationSelectField, type RegistrationCardProps } from './RegistrationFields'

export function AppointmentCard({ draft, errors, onChange }: RegistrationCardProps) {
  const [dateOpen, setDateOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)

  return <>
    <Section title={t('预约信息')} subtitle={t('为本次到访安排合适的时间')}>
      <div className="card form-card">
        <RegistrationSelectField label={t('预约日期')} value={draft.appointmentDate} placeholder={t('请选择预约日期')} error={errors.appointmentDate} actionLabel={t('选择预约日期')} onClick={() => setDateOpen(true)} />
        <RegistrationSelectField label={t('到访时段')} value={draft.timeSlot} placeholder={t('请选择到访时段')} error={errors.timeSlot} actionLabel={t('选择到访时段')} onClick={() => setTimeOpen(true)} />
      </div>
    </Section>
    <DatePicker visible={dateOpen} precision="day" min={new Date(`${today()}T00:00:00+08:00`)} max={new Date('2099-12-31T00:00:00+08:00')} value={new Date(`${draft.appointmentDate || today()}T00:00:00+08:00`)} onClose={() => setDateOpen(false)} onConfirm={value => onChange('appointmentDate', today(value.getTime()))} />
    <Picker visible={timeOpen} columns={[TIME_SLOTS.map(value => ({ label: value, value }))]} onClose={() => setTimeOpen(false)} onConfirm={values => onChange('timeSlot', String(values[0]))} />
  </>
}
