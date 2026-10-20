import { useEffect, useState, type ReactNode } from 'react'
import { Button, Checkbox, Modal } from 'antd-mobile'
import { useNavigate } from 'react-router'
import type { Visit } from '../domain/types'
import { useVisitSafe } from './VisitSafeProvider'
import { Icon, Screen, notifyError } from './UI'

export function ApplicationNotice({ visit, children }: { visit: Visit; children: ReactNode }) {
  const { store } = useVisitSafe()
  const navigate = useNavigate()
  const [agreement, setAgreement] = useState(false)
  const [seconds, setSeconds] = useState(3)
  useEffect(() => {
    if (visit.noticeAcceptedAt !== undefined) return
    setAgreement(false)
    setSeconds(3)
    const deadline = Date.now() + 3000
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    const timer = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [visit.id, visit.noticeAcceptedAt])
  if (visit.noticeAcceptedAt !== undefined) return children
  return <Screen title="申请须知" backTo="/records"><Modal className="notice-modal" bodyClassName="notice-modal-body" bodyStyle={{ maxHeight: 'calc(100dvh - 48px)' }} visible closeOnMaskClick={false} content={<div className="notice-content"><span className="notice-icon"><Icon name="shield" size={38} /></span><h2>{visit.noticeSnapshot.title}</h2><p className="muted small">请确认本次申请须知后继续</p><div className="notice-copy">{visit.noticeSnapshot.content.split('\n').map((line, index) => <p key={index}>{line}</p>)}</div><Checkbox checked={agreement} onChange={setAgreement}>我已阅读并同意以上须知</Checkbox><Button block color="primary" disabled={!agreement || seconds > 0} onClick={() => { try { store.acceptNotice(visit.id) } catch (error) { notifyError(error) } }}>{seconds > 0 ? `确认并继续（${seconds}秒）` : '确认并继续'}</Button><Button block fill="none" onClick={() => navigate('/records')}>暂不确认</Button></div>} /></Screen>
}
