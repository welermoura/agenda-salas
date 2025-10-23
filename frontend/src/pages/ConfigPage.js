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
    });
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Tenta carregar a configuração existente ao montar o componente
        configService.getConfig()
            .then(data => setConfig(data))
            .catch(err => console.log("Nenhuma configuração encontrada ainda."));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prevConfig => ({
            ...prevConfig,
            [name]: name === 'port' ? parseInt(value, 10) : value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setMessage('');
        configService.saveConfig(config)
            .then(response => {
                setMessage(response.message);
            })
            .catch(error => {
                setMessage(error.message);
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
                <button type="submit">Salvar Configuração</button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default ConfigPage;
