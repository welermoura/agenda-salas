import React, { useState } from 'react';
import './AdminPage.css';

const LoginPage = ({ onLoginSuccess }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            // Este endpoint ainda não foi criado no backend, mas será na próxima etapa
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    username: 'admin', // Usuário fixo por enquanto
                    password: password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Senha incorreta.');
            }

            // Armazena o token e chama a função de sucesso
            localStorage.setItem('accessToken', data.access_token);
            onLoginSuccess();

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="admin-container">
            <h1>Login de Administrador</h1>
            <form onSubmit={handleSubmit} className="agenda-form" style={{ flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha"
                    required
                    style={{ minWidth: '300px' }}
                />
                <button type="submit">Entrar</button>
            </form>
            {error && <p className="error-message">{error}</p>}
        </div>
    );
};

export default LoginPage;
