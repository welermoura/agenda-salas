import React, { useState, useEffect } from 'react';
import SetupPage from './SetupPage';
import LoginPage from './LoginPage';
import AdminPage from './AdminPage';

const AdminGuard = ({ onThemeLoaded }) => {
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
                    if (token) {
                        try {
                            const verifyResponse = await fetch('/api/verify', {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (verifyResponse.ok) {
                                setIsAuthenticated(true);
                            } else {
                                localStorage.removeItem('accessToken');
                                setIsAuthenticated(false);
                            }
                        } catch (err) {
                            console.error("Erro ao verificar validade do token:", err);
                            setIsAuthenticated(false);
                        }
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

    return <AdminPage onThemeLoaded={onThemeLoaded} />;
};

export default AdminGuard;
