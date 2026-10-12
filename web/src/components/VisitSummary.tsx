import { AREAS, ENTRIES, maskPhone } from '../domain/store'
import type { Draft, Visit } from '../domain/types'
import { Section } from './UI'

export function VisitSummary({ draft }: { draft: Draft | Visit }) {
  const fields: [string, string][] = [['预约日期', draft.appointmentDate], ['到访时段', draft.timeSlot], ['登记类型', ENTRIES[draft.type].label]]
  if (draft.type === 'visitor') fields.push(['被访人', draft.hostName], ['到访事由', draft.visitReason])
  if (draft.type === 'contractor') fields.push(['项目名称', draft.projectName], ['施工位置', draft.workArea], ['施工单位', draft.contractorCompany], ['现场负责人', draft.supervisor])
  return <>
    <Section title="预约与到访信息"><div className="card">{fields.map(([label, value]) => <div className="summary-row" key={label}><span className="muted">{label}</span><span>{value || '未填写'}</span></div>)}</div></Section>
    <Section title={draft.type === 'logistics' ? '车辆与司机' : '来访人员'}><div className="card">
      {draft.type === 'logistics' ? draft.vehicles.map(vehicle => <div className="summary-person" key={vehicle.id}><strong>{vehicle.plate}</strong><p>{vehicle.driver} · {maskPhone(vehicle.phone)}</p><p className="muted small">{vehicle.company}</p></div>) : draft.people.map(person => <div className="summary-person" key={person.id}><strong>{person.name}</strong><p className="muted">{maskPhone(person.phone)} · {draft.type === 'contractor' ? draft.contractorCompany : person.company}</p>{person.trade && <p className="muted small">工种：{person.trade}</p>}</div>)}
    </div></Section>
    {draft.type !== 'logistics' && <Section title="随行车辆"><div className="card">{draft.accompanyingVehicles.length ? draft.accompanyingVehicles.map(vehicle => <span className="plate-tag" key={vehicle.id}>{vehicle.plate}</span>) : <span className="muted">未登记随行车辆</span>}</div></Section>}
    <Section title="访问区域"><div className="flex flex-wrap gap-2">{draft.areaIds.map(id => <span className="area-tag" key={id}>{AREAS.find(area => area.id === id)?.name}</span>)}</div></Section>
  </>
}
