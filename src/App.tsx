import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RootPage from './pages/Index'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import DashboardPage from './pages/Dashboard'
import ClientsPage from './pages/Clients'
import ClientDetailPage from './pages/ClientDetail'
import ReceivablesPage from './pages/Receivables'
import ReceivableDetailPage from './pages/ReceivableDetail'
import SettingsPage from './pages/Settings'
import NotFound from './pages/NotFound'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/receivables" element={<ReceivablesPage />} />
        <Route path="/receivables/:id" element={<ReceivableDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
