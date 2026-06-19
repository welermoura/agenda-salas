import React, { useState, useEffect, useCallback } from 'react';
import './AdminPage.css';

// Componente para um item da lista de salas, agora com estado de edição
const RoomItem = ({ room, onMove, onRemove, onSave, onUploadLogo, onRemoveLogo, isFirst, isLast }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(room.name);
    const [editedEmail, setEditedEmail] = useState(room.email);

    const handleSave = () => {
        onSave({ name: editedName, email: editedEmail });
        setIsEditing(false);
    };

    const logoContainer = (
        <div className="room-logo-container">
            {room.logo_version > 0 ? (
                <img 
                    src={`/api/rooms/${room.email}/logo?v=${room.logo_version}`} 
                    alt="Logo" 
                    className="room-logo-thumb"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.parentElement.querySelector('.room-avatar-thumb');
                        if (fallback) fallback.style.display = 'flex';
                    }}
                />
            ) : null}
            <div 
                className="room-avatar-thumb" 
                style={{ display: room.logo_version > 0 ? 'none' : 'flex' }}
            >
                {room.name ? room.name.charAt(0).toUpperCase() : '?'}
            </div>
            <label className="logo-upload-label">
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            onUploadLogo(e.target.files[0]);
                        }
                    }} 
                    style={{ display: 'none' }}
                />
                <span>Alterar Logo</span>
            </label>
            {room.logo_version > 0 && (
                <button 
                    type="button" 
                    onClick={onRemoveLogo} 
                    className="logo-remove-btn" 
                    title="Remover logotipo"
                >
                    Remover Logo
                </button>
            )}
        </div>
    );

    if (isEditing) {
        return (
            <li className="room-item-editing">
                <div className="room-item-content">
                    {logoContainer}
                    <div className="room-edit-fields">
                        <div className="input-group">
                            <label>Nome da Sala</label>
                            <input 
                                type="text" 
                                value={editedName} 
                                onChange={(e) => setEditedName(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <label>E-mail da Sala</label>
                            <input 
                                type="email" 
                                value={editedEmail} 
                                onChange={(e) => setEditedEmail(e.target.value)} 
                                required 
                            />
                        </div>
                    </div>
                </div>
                <div className="agenda-actions">
                    <button onClick={handleSave} className="save-btn">Salvar</button>
                    <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancelar</button>
                </div>
            </li>
        );
    }

    return (
        <li className="room-item-view">
            <div className="room-item-content">
                {logoContainer}
                <div className="agenda-info">
                    <strong className="room-title-name">{room.name}</strong>
                    <span className="agenda-url">{room.email}</span>
                </div>
            </div>
            <div className="agenda-actions">
                <div className="order-buttons">
                    <button onClick={() => onMove(-1)} disabled={isFirst} title="Mover para Cima">↑</button>
                    <button onClick={() => onMove(1)} disabled={isLast} title="Mover para Baixo">↓</button>
                </div>
                <button onClick={() => setIsEditing(true)} className="edit-btn">Editar</button>
                <button onClick={onRemove} className="remove-button">Remover</button>
            </div>
        </li>
    );
};

// Hook customizado para fazer requisições autenticadas
const useAuthenticatedFetch = () => {
    const token = localStorage.getItem('accessToken');

    const authenticatedFetch = useCallback(async (url, options = {}) => {
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        };

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            // Token inválido/expirado, força o logout
            localStorage.removeItem('accessToken');
            window.location.reload();
            throw new Error('Sessão expirada. Por favor, faça o login novamente.');
        }

        return response;
    }, [token]);

    return authenticatedFetch;
};


const AdminPage = ({ onThemeLoaded }) => {
    const [activeTab, setActiveTab] = useState('rooms');
    const [rooms, setRooms] = useState([]);
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomEmail, setNewRoomEmail] = useState('');

    const [tenantId, setTenantId] = useState('');
    const [clientId, setClientId] = useState('');
    const [newClientSecret, setNewClientSecret] = useState('');
    const [selectedTheme, setSelectedTheme] = useState('classic');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const authenticatedFetch = useAuthenticatedFetch();

    const [diagStatus, setDiagStatus] = useState({ loading: true, status: '', message: '' });

    const runDiagnostics = useCallback(async () => {
        setDiagStatus(prev => ({ ...prev, loading: true }));
        try {
            const response = await authenticatedFetch('/api/diagnostics');
            const data = await response.json();
            setDiagStatus({ loading: false, status: data.status, message: data.message });
        } catch (err) {
            setDiagStatus({ loading: false, status: 'error', message: err.message });
        }
    }, [authenticatedFetch]);

    useEffect(() => {
        runDiagnostics();
    }, [runDiagnostics]);

    // Carrega os dados iniciais (salas e config)
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Carregar salas
                const roomsResponse = await authenticatedFetch('/api/rooms');
                if (!roomsResponse.ok) throw new Error('Falha ao carregar salas.');
                const roomsData = await roomsResponse.json();
                setRooms(roomsData);

                // Carregar config do Graph
                const configResponse = await authenticatedFetch('/api/config');
                if (!configResponse.ok) throw new Error('Falha ao carregar configuração do Graph.');
                const configData = await configResponse.json();
                setTenantId(configData.tenant_id);
                setClientId(configData.client_id);
                if (configData.selected_theme) {
                    setSelectedTheme(configData.selected_theme);
                    if (onThemeLoaded) {
                        onThemeLoaded(configData.selected_theme);
                    }
                }

            } catch (err) {
                setError(err.message);
            }
        };
        fetchData();
    }, [authenticatedFetch, onThemeLoaded]);

    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    const showValidationError = (msg) => {
        setError(msg);
        setTimeout(() => setError(''), 5000);
    };

    // --- Funções de Manipulação ---

    const handleAddRoom = async (e) => {
        e.preventDefault();
        const updatedRooms = [...rooms, { name: newRoomName, email: newRoomEmail }];
        try {
            const response = await authenticatedFetch('/api/rooms', {
                method: 'POST',
                body: JSON.stringify(updatedRooms),
            });
            if (!response.ok) throw new Error('Falha ao adicionar sala.');
            setRooms(updatedRooms);
            setNewRoomName('');
            setNewRoomEmail('');
            showMessage('Sala adicionada com sucesso!');
        } catch (err) {
            showValidationError(err.message);
        }
    };

    const handleRemoveRoom = async (indexToRemove) => {
        if (!window.confirm('Deseja realmente remover esta sala?')) return;
        const updatedRooms = rooms.filter((_, index) => index !== indexToRemove);
        try {
            const response = await authenticatedFetch('/api/rooms', {
                method: 'POST',
                body: JSON.stringify(updatedRooms),
            });
            if (!response.ok) throw new Error('Falha ao remover sala.');
            setRooms(updatedRooms);
            showMessage('Sala removida com sucesso!');
        } catch (err) {
            showValidationError(err.message);
        }
    };

    const handleMoveRoom = async (index, direction) => {
        const newRooms = [...rooms];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newRooms.length) return;
        [newRooms[index], newRooms[targetIndex]] = [newRooms[targetIndex], newRooms[index]];
        try {
            const response = await authenticatedFetch('/api/rooms', {
                method: 'POST',
                body: JSON.stringify(newRooms),
            });
            if (!response.ok) throw new Error('Falha ao reordenar salas.');
            setRooms(newRooms);
        } catch (err) {
            showValidationError(err.message);
        }
    };

    const handleSaveRoom = async (indexToUpdate, updatedRoom) => {
        const updatedRooms = rooms.map((room, index) =>
            index === indexToUpdate ? updatedRoom : room
        );
        try {
            const response = await authenticatedFetch('/api/rooms', {
                method: 'POST',
                body: JSON.stringify(updatedRooms),
            });
            if (!response.ok) throw new Error('Falha ao salvar a sala.');
            setRooms(updatedRooms);
            showMessage('Sala atualizada com sucesso!');
        } catch (err) {
            showValidationError(err.message);
        }
    };

    const handleUploadLogo = async (indexToUpdate, file) => {
        const room = rooms[indexToUpdate];
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await authenticatedFetch(`/api/rooms/${room.email}/logo`, {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) throw new Error('Falha ao enviar logotipo.');
            const data = await response.json();
            
            // Atualiza localmente a versão do logo daquela sala
            const updatedRooms = rooms.map((r, index) =>
                index === indexToUpdate ? { ...r, logo_version: data.logo_version } : r
            );
            setRooms(updatedRooms);
            showMessage('Logotipo enviado com sucesso!');
        } catch (err) {
            showValidationError(err.message);
        }
    };

    const handleRemoveLogo = async (indexToUpdate) => {
        const room = rooms[indexToUpdate];
        try {
            const response = await authenticatedFetch(`/api/rooms/${room.email}/logo`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Falha ao remover logotipo.');
            
            // Atualiza localmente a versão do logo daquela sala para 0
            const updatedRooms = rooms.map((r, index) =>
                index === indexToUpdate ? { ...r, logo_version: 0 } : r
            );
            setRooms(updatedRooms);
            showMessage('Logotipo removido com sucesso!');
        } catch (err) {
            showValidationError(err.message);
        }
    };

    const handleSaveGraphConfig = async (e) => {
        e.preventDefault();
        try {
            const body = {
                tenant_id: tenantId,
                client_id: clientId,
                client_secret: newClientSecret,
                selected_theme: selectedTheme
            };
            const response = await authenticatedFetch('/api/config', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error('Falha ao salvar as configurações.');

            if (onThemeLoaded) {
                onThemeLoaded(selectedTheme);
            }

            // Limpa o campo do segredo após o envio bem-sucedido
            setNewClientSecret('');
            showMessage('Configurações salvas com sucesso!');
        } catch (err) {
            showValidationError(err.message);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showValidationError('As novas senhas não coincidem.');
            return;
        }
        try {
            const response = await authenticatedFetch('/api/change-password', {
                method: 'POST',
                body: JSON.stringify({ new_password: newPassword }),
            });
            if (!response.ok) throw new Error('Falha ao alterar a senha.');
            setNewPassword('');
            setConfirmPassword('');
            showMessage('Senha alterada com sucesso!');
        } catch (err) {
            showValidationError(err.message);
        }
    };


    return (
        <div className="admin-container">
            <div className="admin-header">
                <h1>Painel de Administração</h1>
                <p className="admin-subtitle">Gerencie suas salas, credenciais da API Microsoft Graph, aparência do Dashboard e segurança.</p>
            </div>

            {/* Notificações flutuantes temporárias */}
            {message && <div className="toast-notification success">{message}</div>}
            {error && <div className="toast-notification error">{error}</div>}

            <div className="admin-content-layout">
                {/* Menu de Abas Lateral */}
                <aside className="admin-sidebar">
                    <button 
                        className={`tab-button ${activeTab === 'rooms' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rooms')}
                    >
                        <span className="tab-icon">🏢</span>
                        <span>Salas de Reunião</span>
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'theme' ? 'active' : ''}`}
                        onClick={() => setActiveTab('theme')}
                    >
                        <span className="tab-icon">🎨</span>
                        <span>Tema e Aparência</span>
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'graph' ? 'active' : ''}`}
                        onClick={() => setActiveTab('graph')}
                    >
                        <span className="tab-icon">⚙️</span>
                        <span>Integração Azure AD</span>
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        <span className="tab-icon">🔒</span>
                        <span>Segurança</span>
                    </button>
                </aside>

                {/* Painel Central de Conteúdo */}
                <main className="admin-main-panel">
                    
                    {/* ABA 1: Salas de Reunião */}
                    {activeTab === 'rooms' && (
                        <div className="tab-pane">
                            <h2>Gerenciar Salas de Reunião</h2>
                            <p className="section-description">Cadastre novas salas sincronizadas com o Outlook do M365, envie logotipos e altere a ordem de exibição no painel.</p>
                            
                            <form onSubmit={handleAddRoom} className="add-room-form">
                                <h3>Nova Sala de Reunião</h3>
                                <div className="form-row-grid">
                                    <div className="input-group">
                                        <label>Nome Amigável da Sala</label>
                                        <input 
                                            type="text" 
                                            value={newRoomName} 
                                            onChange={e => setNewRoomName(e.target.value)} 
                                            placeholder="Ex: Sala Laguna" 
                                            required 
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>E-mail da Sala (Outlook/Exchange)</label>
                                        <input 
                                            type="email" 
                                            value={newRoomEmail} 
                                            onChange={e => setNewRoomEmail(e.target.value)} 
                                            placeholder="sala-laguna@empresa.com" 
                                            required 
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="primary-action-btn">Adicionar Sala</button>
                            </form>

                            <div className="rooms-list-container">
                                <h3>Salas de Reunião Ativas ({rooms.length})</h3>
                                {rooms.length === 0 ? (
                                    <p className="empty-list-message">Nenhuma sala cadastrada. Adicione uma sala no formulário acima.</p>
                                ) : (
                                    <ul className="agendas-list">
                                        {rooms.map((room, index) => (
                                            <RoomItem
                                                key={index}
                                                room={room}
                                                onMove={(dir) => handleMoveRoom(index, dir)}
                                                onRemove={() => handleRemoveRoom(index)}
                                                onSave={(updatedRoom) => handleSaveRoom(index, updatedRoom)}
                                                onUploadLogo={(file) => handleUploadLogo(index, file)}
                                                onRemoveLogo={() => handleRemoveLogo(index)}
                                                isFirst={index === 0}
                                                isLast={index === rooms.length - 1}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ABA 2: Temas e Aparência */}
                    {activeTab === 'theme' && (
                        <div className="tab-pane">
                            <h2>Tema Base do Dashboard</h2>
                            <p className="section-description">Altere o visual e o formato físico da linha de tempo do painel. A modificação é aplicada a todos os clientes que carregarem o dashboard.</p>
                            
                            <form onSubmit={handleSaveGraphConfig} className="theme-selection-form">
                                <div className="input-group" style={{ marginBottom: '20px' }}>
                                    <label>Tema Base Padrão</label>
                                    <select 
                                        value={selectedTheme} 
                                        onChange={e => setSelectedTheme(e.target.value)}
                                        className="styled-select"
                                    >
                                        <optgroup label="Salas em Colunas (Tabela Vertical) - Linha horizontal no meio da tela (busca oculta)">
                                            <option value="aurora">✨ Arctic Aurora (Aurora Ártica & Tabela Vertical)</option>
                                            <option value="desert">🏜️ Desert Dunes (Dunas do Deserto & Tabela Vertical)</option>
                                            <option value="steel">🔩 Industrial Steel (Aço Industrial & Tabela Vertical)</option>
                                            <option value="toxic">☣️ Toxic Acid (Ácido Tóxico & Tabela Vertical)</option>
                                        </optgroup>
                                        <optgroup label="Gantt Clássico (Linha de Tempo Contínua) - Linha vermelha vertical contínua cruzando a grade">
                                            <option value="candy">🍬 Candy Land (Mundo dos Doces & Linha Contínua)</option>
                                            <option value="classic">📏 Clássico (Linha de Tempo Contínua)</option>
                                            <option value="cosmic">🌌 Cosmic Nebula (Nebulosa Cósmica & Linha Contínua)</option>
                                            <option value="cyber">⚡ Neon Cyberpunk (Holograma Digital & Linha Contínua)</option>
                                            <option value="forest">🌲 Forest Moss (Tons de Terra & Linha Contínua)</option>
                                            <option value="glacier">❄️ Glacier Ice (Tons Árticos & Linha Contínua)</option>
                                            <option value="mint">🌿 Mint Fresh (Hortelã & Linha Contínua)</option>
                                            <option value="vintage">📜 Retro Sepia (Papel Envelhecido & Linha Contínua)</option>
                                        </optgroup>
                                        <optgroup label="Cápsulas Flutuantes (Gantt Minimalista) - Linha vermelha vertical com indicador móvel discreto">
                                            <option value="luxury">👑 Luxury Gold (Ouro de Luxo & Cápsulas Flutuantes)</option>
                                            <option value="mono">🖤 Monochrome Slate (Preto e Branco & Cápsulas Flutuantes)</option>
                                            <option value="ocean">🌊 Ocean Breeze (Cápsulas Flutuantes)</option>
                                            <option value="rose">🌹 Rose Gold (Ouro Rosa & Cápsulas Flutuantes)</option>
                                            <option value="sunset">🌅 Sunset Amber (Pôr do Sol & Cápsulas Flutuantes)</option>
                                        </optgroup>
                                        <optgroup label="Resumo Textual (Sem Gráfico) - Listagem textual das reuniões (sem barra de tempo gráfica)">
                                            <option value="corporate">🏢 Corporate Minimal (Resumo Textual)</option>
                                            <option value="plum">🔮 Amethyst Plum (Ametista Roxo & Resumo Textual)</option>
                                            <option value="sakura">🌸 Cherry Sakura (Cerejeira Sakura & Resumo Textual)</option>
                                        </optgroup>
                                    </select>
                                </div>
                                <button type="submit" className="primary-action-btn">Aplicar Tema ao Dashboard</button>
                            </form>
                        </div>
                    )}

                    {/* ABA 3: Integração Azure AD e Diagnósticos */}
                    {activeTab === 'graph' && (
                        <div className="tab-pane">
                            <h2>Integração com Microsoft Graph (API M365)</h2>
                            <p className="section-description">Forneça os identificadores da aplicação registrada na conta Azure AD para permitir que o backend consulte a disponibilidade das salas.</p>
                            
                            {/* Barra de Status e Teste de Conexão */}
                            <div className={`diagnostics-bar status-${diagStatus.status}`}>
                                <div className="diag-text-info">
                                    <span className="diag-indicator-dot"></span>
                                    <div>
                                        <strong>Status da Conexão Azure AD:</strong>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                                            {diagStatus.loading ? 'Realizando testes de comunicação com Microsoft Graph...' : diagStatus.message}
                                        </p>
                                    </div>
                                </div>
                                {!diagStatus.loading && (
                                    <button onClick={runDiagnostics} className="retry-diag-button">
                                        Testar Conexão
                                    </button>
                                )}
                            </div>

                            <form onSubmit={handleSaveGraphConfig} className="azure-config-form">
                                <div className="input-group" style={{ marginBottom: '16px' }}>
                                    <label>Tenant ID (Diretório)</label>
                                    <input 
                                        type="text" 
                                        value={tenantId} 
                                        onChange={e => setTenantId(e.target.value)} 
                                        placeholder="Ex: a1b2c3d4-..." 
                                        required 
                                    />
                                </div>
                                <div className="input-group" style={{ marginBottom: '16px' }}>
                                    <label>Client ID (Aplicação)</label>
                                    <input 
                                        type="text" 
                                        value={clientId} 
                                        onChange={e => setClientId(e.target.value)} 
                                        placeholder="Ex: e5f6g7h8-..." 
                                        required 
                                    />
                                </div>
                                <div className="input-group" style={{ marginBottom: '24px' }}>
                                    <label>Client Secret (Segredo do Cliente)</label>
                                    <input 
                                        type="password" 
                                        value={newClientSecret} 
                                        onChange={e => setNewClientSecret(e.target.value)} 
                                        placeholder="Insira novo valor se desejar alterar o segredo atual" 
                                    />
                                    <span className="input-help-text">
                                        Por motivos de segurança, o Client Secret atual não é exibido. Insira um novo valor apenas para atualizá-lo.
                                    </span>
                                </div>
                                <button type="submit" className="primary-action-btn">Salvar Credenciais da API</button>
                            </form>
                        </div>
                    )}

                    {/* ABA 4: Segurança (Senha) */}
                    {activeTab === 'security' && (
                        <div className="tab-pane">
                            <h2>Alterar Senha do Administrador</h2>
                            <p className="section-description">Defina uma nova credencial de segurança para o acesso do painel de administração.</p>
                            
                            <form onSubmit={handleChangePassword} className="security-form">
                                <div className="input-group" style={{ marginBottom: '16px' }}>
                                    <label>Nova Senha</label>
                                    <input 
                                        type="password" 
                                        value={newPassword} 
                                        onChange={e => setNewPassword(e.target.value)} 
                                        placeholder="Digite a nova senha" 
                                        required 
                                    />
                                </div>
                                <div className="input-group" style={{ marginBottom: '24px' }}>
                                    <label>Confirmar Nova Senha</label>
                                    <input 
                                        type="password" 
                                        value={confirmPassword} 
                                        onChange={e => setConfirmPassword(e.target.value)} 
                                        placeholder="Confirme a nova senha" 
                                        required 
                                    />
                                </div>
                                <button type="submit" className="primary-action-btn">Alterar Senha</button>
                            </form>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
};

export default AdminPage;
