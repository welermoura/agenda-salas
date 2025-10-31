import React, { useState, useEffect } from 'react';
import SetupPage from './SetupPage';
import LoginPage from './LoginPage';
import AdminPage from './AdminPage';

const AdminGuard = () => {
    const [isConfigured, setIsConfigured] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch('/api/setup/status');
                const data = await response.json();
                setIsConfigured(data.is_configured);

                // Se já estiver configurado, verifica se há um token válido
                if (data.is_configured) {
                    const token = localStorage.getItem('accessToken');
                    // Idealmente, aqui haveria uma chamada para validar o token no backend
                    if (token) {
                        setIsAuthenticated(true);
                    }
                }
            } catch (error) {
                console.error("Falha ao verificar o status do setup:", error);
                setIsConfigured(false); // Assume que não está configurado se a API falhar
            } finally {
                setLoading(false);
            }
        };

        checkStatus();
    }, []);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

    if (loading) {
        return (
            <div className="loading-message">
                <div className="spinner"></div>
                <span>Verificando configuração...</span>
            </div>
        );
    }

    if (!isConfigured) {
        return <SetupPage />;
    }

    if (!isAuthenticated) {
        return <LoginPage onLoginSuccess={handleLoginSuccess} />;
    }

    return <AdminPage />;
};

export default AdminGuard;
