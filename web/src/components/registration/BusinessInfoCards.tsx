import { t } from '../../i18n'
import { useState } from 'react'
import { Button, CheckList, Picker, Popup } from 'antd-mobile'
import { CARGO_TYPES, LOGISTICS_REASONS, VISIT_REASONS } from '../../domain/catalog'
import { Icon, Section } from '../UI'
import { RegistrationSelectField, RegistrationTextField, type RegistrationCardProps } from './RegistrationFields'

export function LogisticsBusinessCard(props: RegistrationCardProps) {
  const { draft, errors, onChange } = props
  const [picker, setPicker] = useState<'logisticsReasons' | 'cargoType' | null>(null)
  const multiple = picker === 'logisticsReasons'

  return <>
    <Section title={t('物流业务信息')} subtitle={t('用于说明本次车辆入厂的业务目的与货物情况')}>
      <div className="card form-card">
        <RegistrationSelectField label={t('入厂事由（多选）')} value={draft.logisticsReasons?.join('、') || ''} placeholder={t('请选择入厂事由')} error={errors.logisticsReasons} actionLabel={t('选择入厂事由')} expanded={multiple} onClick={() => setPicker('logisticsReasons')} />
        <RegistrationSelectField label={t('货物类型（单选）')} value={draft.cargoType || ''} placeholder={t('请选择货物类型')} error={errors.cargoType} actionLabel={t('选择货物类型')} expanded={picker === 'cargoType'} onClick={() => setPicker('cargoType')} />
        <RegistrationTextField {...props} field="logisticsOrderNumber" label={t('业务单号')} />
        <RegistrationTextField {...props} field="logisticsContact" label={t('厂内对接人')} />
      </div>
    </Section>
    <Popup visible={!!picker} onMaskClick={() => setPicker(null)} bodyStyle={{ borderRadius: '20px 20px 0 0', maxHeight: '90dvh', overflowY: 'auto' }}>
      <div className="editor-sheet" role="dialog" aria-label={multiple ? t('选择入厂事由') : t('选择货物类型')}>
        <div className="sheet-heading">
          <h2>{multiple ? t('入厂事由（多选）') : t('货物类型（单选）')}</h2>
          <button type="button" className="icon-button" aria-label={t('关闭选择')} onClick={() => setPicker(null)}><Icon name="close" /></button>
        </div>
        <CheckList multiple={multiple} value={multiple ? draft.logisticsReasons || [] : draft.cargoType ? [draft.cargoType] : []} onChange={values => {
          if (picker === 'logisticsReasons') onChange('logisticsReasons', values.map(String))
          else if (picker === 'cargoType') onChange('cargoType', String(values[0] || ''))
        }}>
          {(multiple ? LOGISTICS_REASONS : CARGO_TYPES).map(value => <CheckList.Item key={value} value={value}>{value}</CheckList.Item>)}
        </CheckList>
        <Button block color="primary" onClick={() => setPicker(null)}>{t('完成选择')}</Button>
      </div>
    </Popup>
  </>
}

export function VisitorInfoCard(props: RegistrationCardProps) {
  const { draft, errors, onChange } = props
  const [pickerOpen, setPickerOpen] = useState(false)

  return <>
    <Section title={t('到访信息')}>
      <div className="card form-card">
        <RegistrationTextField {...props} field="hostName" label={t('被访人')} />
        <RegistrationSelectField label={t('到访事由')} value={draft.visitReason} placeholder={t('请选择到访事由')} error={errors.visitReason} onClick={() => setPickerOpen(true)} />
      </div>
    </Section>
    <Picker visible={pickerOpen} columns={[VISIT_REASONS.map(value => ({ label: value, value }))]} onClose={() => setPickerOpen(false)} onConfirm={values => onChange('visitReason', String(values[0]))} />
  </>
}

export function ContractorInfoCard(props: RegistrationCardProps) {
  return <Section title={t('施工信息')}>
    <div className="card form-card">
      <RegistrationTextField {...props} field="projectName" label={t('项目名称')} />
      <RegistrationTextField {...props} field="workArea" label={t('施工位置')} />
      <RegistrationTextField {...props} field="contractorCompany" label={t('施工单位')} />
      <RegistrationTextField {...props} field="supervisor" label={t('现场负责人')} />
    </div>
  </Section>
}
