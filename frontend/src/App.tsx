/* v2 */ import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import RootPage from './pages/Index'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'

import DashboardPage from './pages/Dashboard'
// ClientsPage merged into Dashboard/Operação
import ClientDetailPage from './pages/ClientDetail'
import ReceivablesPage from './pages/Receivables'
import ReceivableDetailPage from './pages/ReceivableDetail'
import SettingsPage from './pages/Settings'
import SettingsCampaignsPage from './pages/SettingsCampaigns'
import SettingsUsersPage from './pages/SettingsUsers'
import ClienteEmDiaBrindesPage from './pages/ClienteEmDiaBrindes'
import ClienteEmDiaCadastrarPage from './pages/ClienteEmDiaCadastrar'
import ClienteEmDiaDetailPage from './pages/ClienteEmDiaDetail'
import ResgatesPage from './pages/Resgates'
import PortalAccessPage from './pages/PortalAccess'
import PortalPointsPage from './pages/PortalPoints'
import SuportePage from './pages/Suporte'
import NotFound from './pages/NotFound'
import AppErrorBoundary from './components/AppErrorBoundary'
import NavigationEventBridge from './components/NavigationEventBridge'
import VersionUpdateNotifier from './components/VersionUpdateNotifier'
import { TooltipProvider } from './components/ui/tooltip'
import { shouldUseHashRouter } from './lib/router'

function App() {
  const Router = shouldUseHashRouter() ? HashRouter : BrowserRouter

  return (
    <AppErrorBoundary>
      <TooltipProvider delayDuration={150}>
        <Router>
          <NavigationEventBridge />
          <VersionUpdateNotifier />
          <Routes>
            <Route path="/" element={<RootPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            <Route path="/portal" element={<PortalAccessPage />} />
            <Route path="/portal/meus-pontos" element={<PortalPointsPage />} />
            <Route path="/operacao" element={<DashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/operacao" replace />} />
            <Route path="/clients" element={<Navigate to="/operacao" replace />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/catalogo" element={<ClienteEmDiaBrindesPage />} />
            <Route path="/cliente-em-dia" element={<Navigate to="/operacao" replace />} />
            <Route path="/cliente-em-dia/brindes" element={<Navigate to="/catalogo" replace />} />
            <Route path="/cliente-em-dia/cadastrar" element={<ClienteEmDiaCadastrarPage />} />
            <Route path="/cliente-em-dia/configuracoes" element={<Navigate to="/admin/campanhas" replace />} />
            <Route path="/cliente-em-dia/resgates" element={<Navigate to="/resgates" replace />} />
            <Route path="/cliente-em-dia/:ixc_cliente_id" element={<ClienteEmDiaDetailPage />} />
            <Route path="/receivables" element={<ReceivablesPage />} />
            <Route path="/receivables/:id" element={<ReceivableDetailPage />} />
            <Route path="/resgates" element={<ResgatesPage />} />
            <Route path="/admin/empresa" element={<SettingsPage />} />
            <Route path="/admin/campanhas" element={<SettingsCampaignsPage />} />
            <Route path="/admin/usuarios" element={<SettingsUsersPage />} />
            <Route path="/settings" element={<Navigate to="/admin/campanhas" replace />} />
            <Route path="/settings/campaigns" element={<Navigate to="/admin/campanhas" replace />} />
            <Route path="/settings/users" element={<Navigate to="/admin/usuarios" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/campanhas" replace />} />
            <Route path="/suporte" element={<SuportePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </AppErrorBoundary>
  )
}

export default App
