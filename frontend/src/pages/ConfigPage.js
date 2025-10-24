// frontend/src/pages/ConfigPage.js
import React, { useState, useEffect } from 'react';
import configService from '../services/configService';

const ConfigPage = () => {
    const [config, setConfig] = useState({
        server: '',
        port: 389,
        user: '',
        password: '',
        base_dn: '',
        domain: '',
    });
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        // Tenta carregar a configuração existente ao montar o componente
        configService.getConfig()
            .then(data => {
                if (data) {
                    setConfig(data);
                }
            })
            .catch(err => {
                console.warn("Nenhuma configuração encontrada no servidor. Isso é esperado na primeira execução.");
            });
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prevConfig => ({
            ...prevConfig,
            [name]: name === 'port' ? parseInt(value, 10) || 0 : value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setMessage('');
        setIsError(false);
        configService.saveConfig(config)
            .then(response => {
                setMessage(response.message);
            })
            .catch(error => {
                setIsError(true);
                // O erro 'Failed to fetch' é um TypeError, que não tem uma mensagem útil.
                // Exibimos uma mensagem mais informativa.
                setMessage("Erro de comunicação com o servidor. Verifique se o backend está rodando e acessível.");
                console.error("Fetch error:", error);
            });
    };

    return (
        <div>
            <h1>Configuração do Active Directory</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Servidor LDAP:</label>
                    <input type="text" name="server" value={config.server} onChange={handleChange} required />
                </div>
                <div>
                    <label>Porta:</label>
                    <input type="number" name="port" value={config.port} onChange={handleChange} required />
                </div>
                <div>
                    <label>Usuário (Bind DN):</label>
                    <input type="text" name="user" value={config.user} onChange={handleChange} required placeholder="ex: cn=admin,dc=example,dc=com" />
                </div>
                <div>
                    <label>Senha:</label>
                    <input type="password" name="password" value={config.password} onChange={handleChange} required />
                </div>
                <div>
                    <label>Base DN:</label>
                    <input type="text" name="base_dn" value={config.base_dn} onChange={handleChange} required placeholder="ex: dc=example,dc=com" />
                </div>
                <div>
                    <label>Domínio:</label>
                    <input type="text" name="domain" value={config.domain} onChange={handleChange} required placeholder="ex: example.com" />
                </div>
                <button type="submit">Salvar Configuração</button>
            </form>
            {message && <p style={{ color: isError ? 'red' : 'green' }}>{message}</p>}
        </div>
    );
};

export default ConfigPage;
