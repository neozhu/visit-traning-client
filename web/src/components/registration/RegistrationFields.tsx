import { t } from '../../i18n'
import { Input } from 'antd-mobile'
import type { Draft } from '../../domain/types'
import { FieldError, Icon } from '../UI'

export type RegistrationChange = <K extends keyof Draft>(field: K, value: Draft[K]) => void

export interface RegistrationCardProps {
  draft: Draft
  errors: Record<string, string>
  onChange: RegistrationChange
}

type TextField = 'hostName' | 'projectName' | 'workArea' | 'contractorCompany' | 'supervisor' | 'logisticsContact' | 'logisticsOrderNumber'

export function RegistrationTextField({ draft, errors, onChange, field, label }: RegistrationCardProps & { field: TextField; label: string }) {
  return <label className="field">
    <span>{label}<em>*</em></span>
    <Input aria-label={label} value={draft[field] || ''} placeholder={t('请输入{0}', { 0: label })} maxLength={60} onChange={value => onChange(field, value)} />
    <FieldError message={errors[field]} />
  </label>
}

export function RegistrationSelectField({ label, value, placeholder, error, onClick, actionLabel, expanded }: {
  label: string
  value: string
  placeholder: string
  error?: string
  onClick: () => void
  actionLabel?: string
  expanded?: boolean
}) {
  return <div className="field">
    <span>{label}<em>*</em></span>
    <button type="button" className={`select-field ${value ? '' : 'placeholder'}`} aria-label={actionLabel} aria-haspopup={expanded === undefined ? undefined : 'dialog'} aria-expanded={expanded} onClick={onClick}>
      {value || placeholder}<Icon name="chevron" size={18} />
    </button>
    <FieldError message={error} />
  </div>
}
