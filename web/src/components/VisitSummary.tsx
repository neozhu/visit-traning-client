import { t } from '../i18n'
import { AREAS, ENTRIES, maskPhone } from '../domain/store'
import type { Draft, Visit } from '../domain/types'
import { Section } from './UI'

export function VisitSummary({ draft }: { draft: Draft | Visit }) {
  const fields: [string, string][] = [[t('预约日期'), draft.appointmentDate], [t('到访时段'), draft.timeSlot], [t('登记类型'), t(ENTRIES[draft.type].label)]]
  if (draft.type === 'visitor') fields.push([t('被访人'), draft.hostName], [t('到访事由'), draft.visitReason])
  if (draft.type === 'logistics') fields.push([t('入厂事由'), draft.logisticsReasons?.join('、') || ''], [t('厂内对接人'), draft.logisticsContact || ''], [t('货物类型'), draft.cargoType || ''], [t('业务单号'), draft.logisticsOrderNumber || ''])
  if (draft.type === 'contractor') fields.push([t('项目名称'), draft.projectName], [t('施工位置'), draft.workArea], [t('施工单位'), draft.contractorCompany], [t('现场负责人'), draft.supervisor])
  return <>
    <Section title={t('预约与到访信息')}><div className="card">{fields.map(([label, value], index) => <div className="summary-row" key={index}><span className="muted">{label}</span><span>{value || t('未填写')}</span></div>)}</div></Section>
    <Section title={draft.type === 'logistics' ? t('车辆与司机') : t('来访人员')}><div className="card">
      {draft.type === 'logistics' ? draft.vehicles.map(vehicle => <div className="summary-person" key={vehicle.id}><strong>{vehicle.plate}</strong><p>{vehicle.driver} · {maskPhone(vehicle.phone)}</p><p className="muted small">{vehicle.company}</p></div>) : draft.people.map(person => <div className="summary-person" key={person.id}><strong>{person.name}</strong><p className="muted">{maskPhone(person.phone)} · {draft.type === 'contractor' ? draft.contractorCompany : person.company}</p>{person.trade && <p className="muted small">{t('工种：')}{person.trade}</p>}</div>)}
    </div></Section>
    {draft.type !== 'logistics' && <Section title={t('随行车辆')}><div className="card">{draft.accompanyingVehicles.length ? draft.accompanyingVehicles.map(vehicle => <span className="plate-tag" key={vehicle.id}>{vehicle.plate}</span>) : <span className="muted">{t('未登记随行车辆')}</span>}</div></Section>}
    <Section title={t('访问区域')}><div className="flex flex-wrap gap-2">{draft.areaIds.map(id => <span className="area-tag" key={id}>{AREAS.find(area => area.id === id)?.name}</span>)}</div></Section>
  </>
}
