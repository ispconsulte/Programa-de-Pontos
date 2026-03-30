import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import RootPage from './pages/Index'
import LoginPage from './pages/Login'

import DashboardPage from './pages/Dashboard'
import ClientsPage from './pages/Clients'
import ClientDetailPage from './pages/ClientDetail'
import ReceivablesPage from './pages/Receivables'
import ReceivableDetailPage from './pages/ReceivableDetail'
import SettingsPage from './pages/Settings'
import ClienteEmDiaPage from './pages/ClienteEmDia'
import ClienteEmDiaBrindesPage from './pages/ClienteEmDiaBrindes'
import ClienteEmDiaCadastrarPage from './pages/ClienteEmDiaCadastrar'
import ClienteEmDiaConfiguracoesPage from './pages/ClienteEmDiaConfiguracoes'
import ClienteEmDiaDetailPage from './pages/ClienteEmDiaDetail'
import ResgatesPage from './pages/Resgates'
import PortalAccessPage from './pages/PortalAccess'
import PortalPointsPage from './pages/PortalPoints'
import NotFound from './pages/NotFound'
import AppErrorBoundary from './components/AppErrorBoundary'
import NavigationEventBridge from './components/NavigationEventBridge'
import VersionUpdateNotifier from './components/VersionUpdateNotifier'
import { shouldUseHashRouter } from './lib/router'

function App() {
  const Router = shouldUseHashRouter() ? HashRouter : BrowserRouter

  return (
    <AppErrorBoundary>
      <Router>
        <NavigationEventBridge />
        <VersionUpdateNotifier />
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/portal" element={<PortalAccessPage />} />
          <Route path="/portal/meus-pontos" element={<PortalPointsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/cliente-em-dia" element={<ClienteEmDiaPage />} />
          <Route path="/cliente-em-dia/brindes" element={<ClienteEmDiaBrindesPage />} />
          <Route path="/cliente-em-dia/cadastrar" element={<ClienteEmDiaCadastrarPage />} />
          <Route path="/cliente-em-dia/configuracoes" element={<ClienteEmDiaConfiguracoesPage />} />
          <Route path="/cliente-em-dia/resgates" element={<ResgatesPage />} />
          <Route path="/cliente-em-dia/:ixc_cliente_id" element={<ClienteEmDiaDetailPage />} />
          <Route path="/receivables" element={<ReceivablesPage />} />
          <Route path="/receivables/:id" element={<ReceivableDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AppErrorBoundary>
  )
}

export default App
