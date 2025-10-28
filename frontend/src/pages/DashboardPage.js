import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './DashboardPage.css';

const API_BASE_URL = `http://${window.location.hostname}:8000`;

const generateTimeSlots = () => {
    const slots = [];
    for (let i = 6; i <= 20; i++) {
        const hour = i.toString().padStart(2, '0');
        slots.push(`${hour}:00`);
    }
    return slots;
};

const getStatusForSlot = (slot, events) => {
    const [hour, minute] = slot.split(':').map(Number);

    const slotTime = new Date();
    slotTime.setHours(hour, minute, 0, 0);
    const slotTimestamp = slotTime.getTime();

    for (const event of events) {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);

        if (slotTimestamp >= eventStart.getTime() && slotTimestamp < eventEnd.getTime()) {
            return 'ocupado';
        }
    }
    return 'livre';
};

const DashboardPage = () => {
    const [agendas, setAgendas] = useState([]);
    const [schedules, setSchedules] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const timeSlots = generateTimeSlots();

    useEffect(() => {
        fetch(`${API_BASE_URL}/agendas`)
            .then(response => response.json())
            .then(data => {
                setAgendas(data);
                if (data.length === 0) {
                    setIsLoading(false);
                }
            })
            .catch(error => {
                console.error('Erro ao buscar agendas:', error);
                setIsLoading(false);
            });

        const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
        const ws = new WebSocket(`${wsUrl}/ws`);
        ws.onmessage = (event) => {
            const newSchedules = JSON.parse(event.data);
            setSchedules(prevSchedules => ({ ...prevSchedules, ...newSchedules }));
            setIsLoading(false);
        };

        return () => ws.close();
    }, []);

    if (isLoading) {
        return <div className="loading-message">Carregando agendas...</div>;
    }

    return (
        <div>
            <nav className="main-nav">
                <Link to="/admin">Ir para Administração</Link>
            </nav>
            <div className="dashboard-grid">
                <div className="time-column">
                    <div className="header-cell">Horário</div>
                    {timeSlots.map(slot => (
                        <div key={slot} className="time-cell">{slot}</div>
                    ))}
                </div>
                {agendas && agendas.length > 0 ? agendas.map(agenda => (
                    <div key={agenda.url} className="room-column">
                        <div className="header-cell">{agenda.name}</div>
                        {timeSlots.map(slot => {
                            const events = schedules[agenda.url] || [];
                            const status = getStatusForSlot(slot, events);
                            return (
                                <div key={slot} className={`status-cell status-${status}`}>
                                    {status.toUpperCase()}
                                </div>
                            );
                        })}
                    </div>
                )) : (
                    <div className="no-agendas-message">Nenhuma sala cadastrada. Adicione uma na página de Administração.</div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;
