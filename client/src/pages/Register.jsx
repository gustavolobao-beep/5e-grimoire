import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell.jsx';
import { Alert, Button, Field, Input } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError('As senhas não conferem.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Fichas de jogador, campanhas de Mestre e bestiário no mesmo lugar."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-medium text-arcane-300 hover:text-arcane-200">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome">
          <Input required value={form.name} onChange={update('name')} placeholder="Como devemos te chamar?" />
        </Field>

        <Field label="E-mail">
          <Input type="email" autoComplete="email" required value={form.email} onChange={update('email')} />
        </Field>

        <Field label="Senha" hint="Mínimo de 6 caracteres.">
          <Input type="password" autoComplete="new-password" required minLength={6} value={form.password} onChange={update('password')} />
        </Field>

        <Field label="Confirmar senha">
          <Input type="password" autoComplete="new-password" required value={form.confirm} onChange={update('confirm')} />
        </Field>

        <Alert>{error}</Alert>

        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
