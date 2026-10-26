import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './components/AppLayout.jsx';
import { LoadingScreen } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Characters from './pages/Characters.jsx';
import CharacterSheet from './pages/CharacterSheet.jsx';
import Campaigns from './pages/Campaigns.jsx';
import CampaignDetail from './pages/CampaignDetail.jsx';
import MasterShield from './pages/MasterShield.jsx';
import Bestiary from './pages/Bestiary.jsx';
import ThreatDetail from './pages/ThreatDetail.jsx';
import Homebrew from './pages/Homebrew.jsx';

/** Bloqueia rotas privadas e devolve o usuário para a tela de entrada. */
function RequireAuth({ children }) {
  const { isAuthenticated, booting } = useAuth();
  const location = useLocation();

  if (booting) return <LoadingScreen label="Abrindo o grimório…" />;
  if (!isAuthenticated) return <Navigate to="/entrar" state={{ from: location }} replace />;
  return children;
}

/** Rotas públicas: se já está logado, vai direto para o painel. */
function PublicOnly({ children }) {
  const { isAuthenticated, booting } = useAuth();
  if (booting) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/registrar" element={<PublicOnly><Register /></PublicOnly>} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/personagens" element={<Characters />} />
        <Route path="/personagens/:id" element={<CharacterSheet />} />
        <Route path="/campanhas" element={<Campaigns />} />
        <Route path="/campanhas/:id" element={<CampaignDetail />} />
        <Route path="/campanhas/:id/escudo" element={<MasterShield />} />
        <Route path="/ameacas" element={<Bestiary />} />
        <Route path="/ameacas/bestiario/:index" element={<ThreatDetail />} />
        <Route path="/ameacas/:id" element={<ThreatDetail />} />
        <Route path="/homebrew" element={<Homebrew />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
