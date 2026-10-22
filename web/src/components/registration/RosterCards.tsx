import { t } from '../../i18n'
import { Button } from 'antd-mobile'
import { maskPhone } from '../../domain/store'
import type { AccompanyingVehicle, Draft, Person, Vehicle } from '../../domain/types'
import { FieldError, Section } from '../UI'

function RosterActions({ name, onEdit, onRemove }: { name: string; onEdit: () => void; onRemove: () => void }) {
  return <div className="roster-actions">
    <button type="button" aria-label={t('编辑{0}', { 0: name })} title={t('编辑')} onClick={onEdit}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z" /><path d="m14 5 5 5" /></svg></button>
    <button type="button" className="danger" aria-label={t('删除{0}', { 0: name })} title={t('删除')} onClick={onRemove}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg></button>
  </div>
}

export function RegistrationRosterCard({ draft, error, onEdit, onRemove }: {
  draft: Draft
  error?: string
  onEdit: (item?: Person | Vehicle) => void
  onRemove: (id: string) => void
}) {
  const type = draft.type
  const items = type === 'logistics' ? draft.vehicles : draft.people

  return <Section title={type === 'logistics' ? t('车辆与司机') : type === 'contractor' ? t('施工人员') : t('来访人员')} subtitle={t('每位人员均需独立完成安全培训')}>
    {items.map((item, index) => {
      const name = 'plate' in item ? item.plate : item.name
      return <article className="card roster-card" key={item.id} aria-label={t('{0}登记信息', { 0: name })}>
        <div className="roster-heading">
          <span className="roster-number" aria-hidden="true">{index + 1}</span><strong>{name}</strong>
          <RosterActions name={name} onEdit={() => onEdit(item)} onRemove={() => onRemove(item.id)} />
        </div>
        <dl className="roster-details">
          {'driver' in item && <div><dt>{t('司机')}</dt><dd>{item.driver}</dd></div>}
          <div><dt>{t('手机')}</dt><dd>{maskPhone(item.phone)}</dd></div>
          <div><dt>{type === 'logistics' ? t('运输单位') : t('所属单位')}</dt><dd>{type === 'contractor' ? draft.contractorCompany : item.company}</dd></div>
          {type === 'contractor' && 'trade' in item && <div><dt>{t('工种')}</dt><dd>{item.trade}</dd></div>}
        </dl>
      </article>
    })}
    {!items.length && <div className="roster-empty">{t('尚未添加{0}', { 0: type === 'logistics' ? t('车辆及司机') : t('人员') })}</div>}
    <FieldError message={error} />
    <Button block color="primary" fill="outline" onClick={() => onEdit()}>{t('＋ 添加{0}', { 0: type === 'logistics' ? t('车辆及司机') : t('人员') })}</Button>
  </Section>
}

export function AccompanyingVehiclesCard({ vehicles, error, onEdit, onRemove }: {
  vehicles: AccompanyingVehicle[]
  error?: string
  onEdit: (vehicle?: AccompanyingVehicle) => void
  onRemove: (id: string) => void
}) {
  return <Section title={t('随行车辆')} subtitle={t('选填，只需登记车牌')}>
    {vehicles.map((vehicle, index) => <article className="card roster-card plate-roster-card" key={vehicle.id} aria-label={t('{0}随行车辆', { 0: vehicle.plate })}>
      <div className="roster-heading">
        <span className="roster-number" aria-hidden="true">{index + 1}</span><strong>{vehicle.plate}</strong>
        <RosterActions name={t('车牌{0}', { 0: vehicle.plate })} onEdit={() => onEdit(vehicle)} onRemove={() => onRemove(vehicle.id)} />
      </div>
    </article>)}
    <FieldError message={error} />
    <Button block fill="outline" color="primary" onClick={() => onEdit()}>{t('＋ 添加随行车牌')}</Button>
  </Section>
}
