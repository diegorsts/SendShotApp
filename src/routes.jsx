import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './utils/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ListEditor from './pages/ListEditor'

function PrivateRoute({ children, levels = [] }) {
  const { token, nivelAcesso } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (levels.length > 0 && !levels.includes(nivelAcesso)) return <Navigate to="/dashboard" replace />
  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      } />
      <Route path="/lista/:userId" element={
        <PrivateRoute levels={['admin', 'globalAdmin']}>
          <ListEditor />
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
