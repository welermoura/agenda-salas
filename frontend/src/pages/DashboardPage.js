import React, { useState, useEffect } from 'react';
import './DashboardPage.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const DashboardPage = () => {
    const [agendas, setAgendas] = useState([]);
    const [statuses, setStatuses] = useState({});

    useEffect(() => {
        fetch(`${API_BASE_URL}/agendas`)
            .then(response => response.json())
            .then(data => {
                setAgendas(data);
                // Initialize statuses
                const initialStatuses = {};
                data.forEach(agenda => {
                    initialStatuses[agenda.url] = 'desconhecido';
                });
                setStatuses(initialStatuses);
            })
            .catch(error => console.error('Erro ao buscar agendas:', error));

        const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
        const ws = new WebSocket(`${wsUrl}/ws`);
        ws.onmessage = (event) => {
            const newStatuses = JSON.parse(event.data);
            setStatuses(prevStatuses => ({ ...prevStatuses, ...newStatuses }));
        };

        return () => {
            ws.close();
        };
    }, []);

    return (
        <div className="dashboard-container">
            {agendas.map((agenda) => (
                <div key={agenda.url} className={`room-column status-${statuses[agenda.url] || 'desconhecido'}`}>
                    <h2 className="room-name">{agenda.name}</h2>
                    <p className="room-status">{(statuses[agenda.url] || 'desconhecido').toUpperCase()}</p>
                </div>
            ))}
        </div>
    );
};

export default DashboardPage;
