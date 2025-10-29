import React, { useState, useEffect } from 'react';

const DashboardPage = () => {
    const [schedules, setSchedules] = useState({});
    const [loading, setLoading] = useState(true);

    const WS_URL = `ws://${window.location.hostname}:8000/ws`;

    useEffect(() => {
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log("Conexão WebSocket estabelecida.");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setSchedules(data);
            setLoading(false); // Dados recebidos, para de carregar
        };

        ws.onclose = () => {
            console.log("Conexão WebSocket fechada.");
        };

        ws.onerror = (error) => {
            console.error("Erro no WebSocket:", error);
            setLoading(false);
        };

        // Limpa a conexão ao desmontar o componente
        return () => {
            ws.close();
        };
    }, [WS_URL]);

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDateTime = (date) => {
        const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
        let formattedDate = date.toLocaleDateString('pt-BR', dateOptions);
        formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

        const timeString = date.toLocaleTimeString('pt-BR');

        return { date: formattedDate, time: timeString };
    };

    const { date, time } = formatDateTime(currentTime);

    // Define o cabeçalho de horas cheias
    const hours = Array.from({ length: 15 }, (_, i) => (i + 6).toString().padStart(2, '0'));

    return (
        <div className="dashboard-page">
            {loading ? (
                <p className="loading-message">Favor aguarde, carregando agendas.</p>
            ) : (
                <>
                    <div className="dashboard-header">
                        <h1>Dashboard de Salas</h1>
                        <div className="real-time-clock">
                            <div className="date-display">{date}</div>
                            <div className="time-display">{time}</div>
                        </div>
                    </div>

                    {Object.keys(schedules).length === 0 ? (
                        <p>Nenhuma agenda cadastrada. Adicione uma na <a href="/admin">página de administração</a>.</p>
                    ) : (
                        <table className="schedule-table">
                            <thead>
                                <tr>
                                    <th className="room-header-cell">Sala</th>
                                    {hours.map(hour => <th key={hour}>{hour}h</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(schedules).map(([url, data]) => (
                                    <tr key={url}>
                                        <td className="room-name-cell">{data.nome}</td>
                                        {hours.map(hour => {
                                            const slot1_status = data.status[`${hour}:00`] || 'livre';
                                            const slot2_status = data.status[`${hour}:30`] || 'livre';

                                            return (
                                                <td key={hour} className="hour-cell">
                                                    <div className={`time-slot slot-00 status-${slot1_status}`}>
                                                        {slot1_status === 'ocupado' ? 'Ocupado' : 'Livre'}
                                                    </div>
                                                    <div className={`time-slot slot-30 status-${slot2_status}`}>
                                                        {slot2_status === 'ocupado' ? 'Ocupado' : 'Livre'}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </div>
    );
};

export default DashboardPage;
