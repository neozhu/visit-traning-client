import { t } from './i18n'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { useEffect } from 'react'
import { VisitSafeProvider } from './components/VisitSafeProvider'
import { Missing } from './components/UI'
import { HomePage } from './pages/HomePage'
import { RegistrationPage } from './pages/RegistrationPage'
import { TrainingPage } from './pages/TrainingPage'
import { TasksPage } from './pages/TasksPage'
import { LearnPage } from './pages/LearnPage'
import { ExamPage } from './pages/ExamPage'
import { CompletionPage, ResultPage } from './pages/ResultPage'
import { RecordDetailPage, RecordsPage } from './pages/RecordsPage'

function ScrollToTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0) }, [pathname]); return null }
function RegistrationRoute() { const { type } = useParams(); return <RegistrationPage key={type} /> }

export function App() {
  return <VisitSafeProvider><BrowserRouter><ScrollToTop /><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/registration/:type" element={<RegistrationRoute />} />
    <Route path="/training" element={<TrainingPage />} />
    <Route path="/tasks/:visitId" element={<TasksPage />} />
    <Route path="/learn/:taskId" element={<LearnPage />} />
    <Route path="/exam/:taskId" element={<ExamPage />} />
    <Route path="/result/:taskId" element={<ResultPage />} />
    <Route path="/completion/:taskId" element={<CompletionPage />} />
    <Route path="/records" element={<RecordsPage />} />
    <Route path="/records/:visitId" element={<RecordDetailPage />} />
    <Route path="/index.html" element={<Navigate to="/" replace />} />
    <Route path="*" element={<Missing title={t('页面不存在')} />} />
  </Routes></BrowserRouter></VisitSafeProvider>
}
