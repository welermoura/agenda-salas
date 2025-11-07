import React, { useState, useEffect, useCallback } from 'react';
import './AdminPage.css';

// Componente para um item da lista de salas, agora com estado de edição
const RoomItem = ({ room, onMove, onRemove, onSave, isFirst, isLast }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(room.name);
    const [editedEmail, setEditedEmail] = useState(room.email);

    const handleSave = () => {
        onSave({ name: editedName, email: editedEmail });
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <li>
                <div className="agenda-info">
                    <input type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} />
                    <input type="email" value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} />
                </div>
                <div className="agenda-actions">
                    <button onClick={handleSave}>Salvar</button>
                    <button onClick={() => setIsEditing(false)}>Cancelar</button>
                </div>
            </li>
        );
    }

    return (
        <li>
            <div className="agenda-info">
                <strong>{room.name}</strong>
                <span className="agenda-url">{room.email}</span>
            </div>
            <div className="agenda-actions">
                <button onClick={() => onMove(-1)} disabled={isFirst}>↑</button>
                <button onClick={() => onMove(1)} disabled={isLast}>↓</button>
                <button onClick={() => setIsEditing(true)}>Editar</button>
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
            'Content-Type': 'application/json',
        };

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


const AdminPage = () => {
    const [rooms, setRooms] = useState([]);
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomEmail, setNewRoomEmail] = useState('');

    const [tenantId, setTenantId] = useState('');
    const [clientId, setClientId] = useState('');
    const [newClientSecret, setNewClientSecret] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const authenticatedFetch = useAuthenticatedFetch();

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

            } catch (err) {
                setError(err.message);
            }
        };
        fetchData();
    }, [authenticatedFetch]);

    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
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
            setError(err.message);
        }
    };

    const handleRemoveRoom = async (indexToRemove) => {
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
            setError(err.message);
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
            setError(err.message);
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
            setError(err.message);
        }
    };

    const handleSaveGraphConfig = async (e) => {
        e.preventDefault();
        try {
            const body = {
                tenant_id: tenantId,
                client_id: clientId,
                client_secret: newClientSecret,
            };
            const response = await authenticatedFetch('/api/config', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error('Falha ao salvar configuração do Graph.');

            // Limpa o campo do segredo após o envio bem-sucedido
            setNewClientSecret('');
            showMessage('Configuração do Graph salva com sucesso!');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('As novas senhas não coincidem.');
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
            setError(err.message);
        }
    };


    return (
        <div className="admin-container">
            <h1>Administração</h1>
            {error && <p className="error-message">{error}</p>}
            {message && <p style={{ color: 'green', textAlign: 'center' }}>{message}</p>}

            {/* Gerenciamento de Salas */}
            <section>
                <h2>Gerenciar Salas de Reunião</h2>
                <form onSubmit={handleAddRoom} className="agenda-form">
                    <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="Nome da Sala" required />
                    <input type="email" value={newRoomEmail} onChange={e => setNewRoomEmail(e.target.value)} placeholder="E-mail da Sala" required />
                    <button type="submit">Adicionar Sala</button>
                </form>
                <ul className="agendas-list">
                    {rooms.map((room, index) => (
                        <RoomItem
                            key={index}
                            room={room}
                            onMove={(dir) => handleMoveRoom(index, dir)}
                            onRemove={() => handleRemoveRoom(index)}
                            onSave={(updatedRoom) => handleSaveRoom(index, updatedRoom)}
                            isFirst={index === 0}
                            isLast={index === rooms.length - 1}
                        />
                    ))}
                </ul>
            </section>

            {/* Configuração do Graph */}
            <section>
                <h2>Configuração da API Microsoft Graph</h2>
                <form onSubmit={handleSaveGraphConfig} className="agenda-form">
                    <input type="text" value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant ID" required />
                    <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID" required />
                    <input type="password" value={newClientSecret} onChange={e => setNewClientSecret(e.target.value)} placeholder="Novo Client Secret (deixe em branco para manter o atual)" />
                    <button type="submit">Salvar Configuração do Graph</button>
                </form>
                <p>O Client Secret não é visualizado por segurança. Para o alterar, insira um novo valor no campo acima.</p>
            </section>

            {/* Alteração de Senha */}
            <section>
                <h2>Alterar Senha de Administrador</h2>
                <form onSubmit={handleChangePassword} className="agenda-form">
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nova Senha" required />
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmar Nova Senha" required />
                    <button type="submit">Alterar Senha</button>
                </form>
            </section>
        </div>
    );
};

export default AdminPage;
