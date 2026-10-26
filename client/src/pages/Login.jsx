import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell.jsx';
import { Alert, Button, Field, Input } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from?.pathname ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Entrar na mesa"
      subtitle="Use sua conta para acessar fichas e campanhas."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/registrar" className="font-medium text-arcane-300 hover:text-arcane-200">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="E-mail">
          <Input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={update('email')}
            placeholder="voce@grimorio.dev"
          />
        </Field>

        <Field label="Senha">
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={update('password')}
            placeholder="••••••"
          />
        </Field>

        <Alert>{error}</Alert>

        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
