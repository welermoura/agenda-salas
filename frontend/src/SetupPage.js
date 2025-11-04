import React, { useState } from 'react';
import './AdminPage.css'; // Reutilizando alguns estilos

const SetupPage = () => {
    const [adminPassword, setAdminPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [tenantId, setTenantId] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (adminPassword !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        try {
            const response = await fetch('/api/setup/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin_password: adminPassword,
                    tenant_id: tenantId,
                    client_id: clientId,
                    client_secret: clientSecret,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Falha ao inicializar a configuração.');
            }

            setMessage('Configuração concluída com sucesso! Recarregue a página para fazer o login.');
            // Desabilitar o formulário ou redirecionar seria uma boa UX aqui.

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="admin-container">
            <h1>Configuração Inicial da Aplicação</h1>
            <p>Bem-vindo! Por favor, forneça as informações abaixo para configurar a aplicação.</p>

            <form onSubmit={handleSubmit} className="agenda-form">
                <h2>Credenciais de Administrador</h2>
                <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Defina uma senha de administrador"
                    required
                />
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a senha"
                    required
                />

                <h2>Configurações da API Microsoft Graph</h2>
                <input
                    type="text"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="Tenant ID (ID do Diretório)"
                    required
                />
                <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Client ID (ID da Aplicação)"
                    required
                />
                <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Client Secret (Valor)"
                    required
                />

                <button type="submit">Salvar Configuração</button>
            </form>

            {error && <p className="error-message">{error}</p>}
            {message && <p style={{ color: 'green' }}>{message}</p>}
        </div>
    );
};

export default SetupPage;
