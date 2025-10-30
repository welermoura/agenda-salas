import React, { useState, useEffect, useRef } from 'react';

// --- Funções Auxiliares de Data ---
// Formata um objeto Date para 'YYYY-MM-DD' ou 'DD/MM/YYYY'
const formatDate = (date, format = 'YYYY-MM-DD') => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    if (format === 'DD/MM/YYYY') {
        return `${day}/${month}/${year}`;
    }
    return `${year}-${month}-${day}`;
};

// Adiciona ou subtrai dias de uma data no formato 'YYYY-MM-DD'
const addDays = (dateStr, days) => {
    const date = new Date(dateStr + 'T00:00:00'); // Adiciona T00:00:00 para evitar problemas de fuso
    date.setDate(date.getDate() + days);
    return formatDate(date);
};
// --- Fim das Funções Auxiliares ---


const DashboardPage = () => {
    const [schedules, setSchedules] = useState(null); // Inicia como null para diferenciar do estado "vazio"
    const [loading, setLoading] = useState(true);
    // Estado para controlar a data, inicializado com a data atual
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

    const ws = useRef(null);
    const WS_URL = `ws://${window.location.hostname}:8000/ws`;

    useEffect(() => {
        // A função de conexão é movida para dentro do useEffect para lidar com selectedDate
        const connect = () => {
            ws.current = new WebSocket(WS_URL);

            ws.current.onopen = () => {
                console.log("Conexão WebSocket estabelecida.");
                // Solicita os dados para a data selecionada ao conectar
                ws.current.send(JSON.stringify({ date: selectedDate }));
            };

            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                // Apenas atualiza o estado se a data recebida for a mesma da selecionada
                if (data.date === selectedDate) {
                    setSchedules(data.statuses);
                    setLoading(false);
                }
            };

            ws.current.onclose = () => {
                console.log("Conexão WebSocket fechada.");
            };

            ws.current.onerror = (error) => {
                console.error("Erro no WebSocket:", error);
                setLoading(false);
            };
        };

        connect();

        // Limpa a conexão ao desmontar o componente
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [WS_URL, selectedDate]);

    // Gera as horas cheias para as linhas, começando das 8:00
    const hours = Array.from({ length: 13 }, (_, i) => (i + 8).toString().padStart(2, '0'));

    // Extrai as salas para as colunas, garantindo que schedules não seja nulo
    const rooms = schedules ? Object.entries(schedules).map(([url, data]) => ({ url, nome: data.nome })) : [];

    const currentHour = new Date().getHours();
    const isToday = selectedDate === formatDate(new Date());

    useEffect(() => {
        // Rola para a hora atual apenas se for hoje e os dados estiverem carregados
        if (!loading && isToday) {
            const now = new Date();
            const hour = now.getHours().toString().padStart(2, '0');
            const currentHourRowId = `hour-row-${hour}`;

            const element = document.getElementById(currentHourRowId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [loading, isToday]);

    // Funções para navegar entre as datas
    const handleDateChange = (days) => {
        const newDate = addDays(selectedDate, days);
        setSelectedDate(newDate);
        setLoading(true); // Mostra o loading ao mudar de data
    };

    const goToToday = () => {
        const today = formatDate(new Date());
        setSelectedDate(today);
        setLoading(true);
    };

    // Converte a data 'YYYY-MM-DD' para 'DD/MM/YYYY' para exibição
    const displayDate = formatDate(new Date(selectedDate + 'T00:00:00'), 'DD/MM/YYYY');


    return (
        <div className="dashboard-page">
            <div className="date-navigation">
                <button onClick={() => handleDateChange(-1)}>&lt; Anterior</button>
                <span className="current-date">{displayDate}</span>
                <button onClick={() => handleDateChange(1)}>Próximo &gt;</button>
                <button onClick={goToToday} className="today-button">Hoje</button>
            </div>

            {(loading || schedules === null) ? (
                <div className="loading-message">
                    <div className="spinner"></div>
                    <span>Carregando Agendas para {displayDate}, favor aguarde...</span>
                </div>
            ) : (
                <>
                    {rooms.length === 0 ? (
                        <p>Nenhuma agenda cadastrada. Adicione uma na <a href="/admin">página de administração</a>.</p>
                    ) : (
                        <div className="table-scroll-container">
                            <table className="schedule-table schedule-table-vertical">
                                <thead>
                                    <tr>
                                        <th className="time-header-cell">Horário</th>
                                        {rooms.map(room => <th key={room.url}>{room.nome}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {hours.map(hour => (
                                        <tr key={hour} id={`hour-row-${hour}`} className={(isToday && parseInt(hour) < currentHour) ? 'past-time-slot' : ''}>
                                            <th className="time-cell">{hour}:00</th>
                                            {rooms.map(room => {
                                                // Garante que schedules e schedules[room.url] existam
                                                const status = schedules && schedules[room.url] ? schedules[room.url].status : {};
                                                const slot1_status = status[`${hour}:00`] || 'indisponivel';
                                                const slot2_status = schedules[room.url]?.status[`${hour}:30`] || 'indisponivel';
                                                return (
                                                    <td key={room.url} className="status-cell">
                                                        <div className={`half-hour-slot slot-top status-${slot1_status}`}>
                                                            {slot1_status.charAt(0).toUpperCase() + slot1_status.slice(1)}
                                                        </div>
                                                        <div className={`half-hour-slot slot-bottom status-${slot2_status}`}>
                                                            {slot2_status.charAt(0).toUpperCase() + slot2_status.slice(1)}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default DashboardPage;
