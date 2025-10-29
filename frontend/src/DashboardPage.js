import React, { useState, useEffect } from 'react';
import RoomRow from './RoomRow'; // Importa o novo componente RoomRow

// Componente para o relógio
const Clock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const date = time.toLocaleDateString('pt-BR', options);
    const currentTime = time.toLocaleTimeString('pt-BR');

    return (
        <div className="clock">
            <p className="date">{date}</p>
            <p className="time">{currentTime}</p>
        </div>
    );
};

const DashboardPage = () => {
    const [schedules, setSchedules] = useState({});
    const [loading, setLoading] = useState(true);

    const WS_URL = `ws://${window.location.hostname}:8000/ws`;

    useEffect(() => {
        const ws = new WebSocket(WS_URL);
        ws.onopen = () => console.log("Conexão WebSocket estabelecida.");
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setSchedules(data);
            setLoading(false);
        };
        ws.onclose = () => console.log("Conexão WebSocket fechada.");
        ws.onerror = (error) => {
            console.error("Erro no WebSocket:", error);
            setLoading(false);
        };
        return () => ws.close();
    }, [WS_URL]);

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <h1>Disponibilidade de Salas de Reunião</h1>
                <Clock />
            </header>

            {loading && <p className="loading-message">Carregando status das salas...</p>}

            {!loading && Object.keys(schedules).length === 0 && (
                <div className="container">
                    <p>Nenhuma agenda cadastrada. Adicione uma na página de administração (acessível em /admin).</p>
                </div>
            )}

            <div className="rows-container">
                {Object.entries(schedules).map(([url, data]) => (
                    <RoomRow key={url} name={data.nome} schedule={data.status} />
                ))}
            </div>
        </div>
    );
};

export default DashboardPage;
