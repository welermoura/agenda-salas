import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Funções Auxiliares de Data ---
const formatDate = (date, format = 'YYYY-MM-DD') => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    if (format === 'DD/MM/YYYY') {
        return `${day}/${month}/${year}`;
    }
    return `${year}-${month}-${day}`;
};

const addDays = (dateStr, days) => {
    const date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() + days);
    return formatDate(date);
};

// Slots de 30 minutos das 08:00 às 19:30 (total de 24 slots)
const TIME_SLOTS = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", 
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", 
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", 
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
];

// Marcadores de hora para exibir na régua da timeline Gantt
const HOUR_MARKERS = [
    { label: "08:00", position: 0 },
    { label: "10:00", position: 16.66 },
    { label: "12:00", position: 33.33 },
    { label: "14:00", position: 50.00 },
    { label: "16:00", position: 66.66 },
    { label: "18:00", position: 83.33 },
    { label: "20:00", position: 100.00 }
];

const DashboardPage = () => {
    const [schedules, setSchedules] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
    const [scheduleCache, setScheduleCache] = useState({});
    
    // Controles de Pesquisa e Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [expandedRooms, setExpandedRooms] = useState({});

    // Indicador da linha de tempo atual (%)
    const [nowPosition, setNowPosition] = useState(null);

    const ws = useRef(null);
    const WS_URL = process.env.REACT_APP_WS_URL || `ws://${window.location.host}/ws`;
    const selectedDateRef = useRef(selectedDate);

    // Efeito para sincronizar a ref da data
    useEffect(() => {
        selectedDateRef.current = selectedDate;
    }, [selectedDate]);

    // Efeito para calcular a posição vertical vermelha (Live Time Indicator)
    const updateTimeIndicator = useCallback(() => {
        const isToday = selectedDate === formatDate(new Date());
        if (!isToday) {
            setNowPosition(null);
            return;
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = 8 * 60;   // 08:00
        const endMinutes = 20 * 60;    // 20:00 (fim do slot das 19:30)

        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
            const pos = ((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
            setNowPosition(pos);
        } else {
            setNowPosition(null);
        }
    }, [selectedDate]);

    useEffect(() => {
        updateTimeIndicator();
        const timer = setInterval(updateTimeIndicator, 30000); // Atualiza a cada 30 segundos
        return () => clearInterval(timer);
    }, [updateTimeIndicator]);

    // Conexão WebSocket
    useEffect(() => {
        const connect = () => {
            console.log("Tentando conectar ao WebSocket...");
            ws.current = new WebSocket(WS_URL);

            ws.current.onopen = () => {
                console.log("Conexão WebSocket estabelecida.");
                if (!scheduleCache[selectedDateRef.current]) {
                    ws.current.send(JSON.stringify({ date: selectedDateRef.current }));
                }
            };

            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                setScheduleCache(prevCache => ({ ...prevCache, [data.date]: data.statuses }));

                if (data.date === selectedDateRef.current) {
                    setSchedules(data.statuses);
                    setLoading(false);
                }
            };

            ws.current.onclose = (event) => {
                console.log("Conexão WebSocket fechada. Tentando reconectar em 5 segundos...", event.reason);
                setTimeout(connect, 5000);
            };

            ws.current.onerror = (error) => {
                console.error("Erro no WebSocket:", error);
                ws.current.close();
            };
        };

        connect();

        return () => {
            if (ws.current) ws.current.close();
        };
    }, [WS_URL]); // eslint-disable-line react-hooks/exhaustive-deps

    // Efeito para atualizar visualização ao mudar de data ou obter do cache
    useEffect(() => {
        if (scheduleCache[selectedDate]) {
            setSchedules(scheduleCache[selectedDate]);
            setLoading(false);
        } else {
            setLoading(true);
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ date: selectedDate }));
            }
        }
    }, [selectedDate, scheduleCache]);

    // Pré-carregamento (Prefetch) do dia seguinte
    useEffect(() => {
        if (!loading && ws.current && ws.current.readyState === WebSocket.OPEN) {
            const nextDate = addDays(selectedDate, 1);
            if (!scheduleCache[nextDate]) {
                console.log(`Pré-carregando dados para: ${nextDate}`);
                ws.current.send(JSON.stringify({ date: nextDate }));
            }
        }
    }, [loading, selectedDate, scheduleCache]);

    // Helpers de Status da Sala
    const getRoomCurrentStatus = (roomData) => {
        if (!roomData || roomData.error) return 'offline';
        
        const now = new Date();
        const hour = now.getHours();
        const minutes = now.getMinutes() >= 30 ? '30' : '00';
        const currentSlotKey = `${hour.toString().padStart(2, '0')}:${minutes}`;
        
        const status = roomData.status || {};
        return status[currentSlotKey] || 'offline';
    };

    const getMeetingProgress = (roomStatus) => {
        if (!roomStatus) return null;
        
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startOfDayMinutes = 8 * 60; // 08:00
        const endOfDayMinutes = 20 * 60;  // 20:00
        
        // Se estiver fora do horário da grade, não calcula progresso
        if (currentMinutes < startOfDayMinutes || currentMinutes > endOfDayMinutes) {
            return null;
        }

        const currentHour = now.getHours();
        const currentHalf = now.getMinutes() >= 30 ? '30' : '00';
        const currentSlotKey = `${currentHour.toString().padStart(2, '0')}:${currentHalf}`;
        
        if (roomStatus[currentSlotKey] !== 'ocupado') {
            return null;
        }

        // 1. Procurar início da reunião (voltando no tempo)
        let startSlotIdx = TIME_SLOTS.indexOf(currentSlotKey);
        while (startSlotIdx > 0 && roomStatus[TIME_SLOTS[startSlotIdx - 1]] === 'ocupado') {
            startSlotIdx--;
        }
        const [startH, startM] = TIME_SLOTS[startSlotIdx].split(':').map(Number);
        const startMinutes = startH * 60 + startM;

        // 2. Procurar fim da reunião (avançando no tempo)
        let endSlotIdx = TIME_SLOTS.indexOf(currentSlotKey);
        while (endSlotIdx < TIME_SLOTS.length - 1 && roomStatus[TIME_SLOTS[endSlotIdx + 1]] === 'ocupado') {
            endSlotIdx++;
        }
        
        // O fim da reunião é o início do próximo slot livre ou 20:00 se for o último slot
        let endMinutes;
        if (endSlotIdx === TIME_SLOTS.length - 1) {
            endMinutes = 20 * 60; // 20:00
        } else {
            const [nextH, nextM] = TIME_SLOTS[endSlotIdx + 1].split(':').map(Number);
            endMinutes = nextH * 60 + nextM;
        }

        const totalDuration = endMinutes - startMinutes;
        const elapsed = currentMinutes - startMinutes;
        const timeLeft = endMinutes - currentMinutes;
        const percentage = totalDuration > 0 ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;

        return {
            timeLeft,
            percentage,
            totalDuration
        };
    };

    const getStatusText = (status) => {
        if (status === 'livre') return 'Livre';
        if (status === 'ocupado') return 'Ocupada';
        return 'Indisponível';
    };

    const toggleExpandRoom = (email) => {
        setExpandedRooms(prev => ({ ...prev, [email]: !prev[email] }));
    };

    const goToToday = () => {
        setSelectedDate(formatDate(new Date()));
        setLoading(true);
    };

    const goToPreviousDay = () => {
        setSelectedDate(prevDate => addDays(prevDate, -1));
        setLoading(true);
    };

    const goToNextDay = () => {
        setSelectedDate(prevDate => addDays(prevDate, 1));
        setLoading(true);
    };

    // Filtros e Pesquisa
    const rooms = schedules ? Object.entries(schedules).map(([url, data]) => ({ url, nome: data.nome, logo_version: data.logo_version || 0 })) : [];

    const filteredRooms = rooms.filter(room => {
        const matchesSearch = room.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              room.url.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        const roomData = schedules && schedules[room.url];
        const currentStatus = getRoomCurrentStatus(roomData);

        if (statusFilter === 'free') return currentStatus === 'livre';
        if (statusFilter === 'busy') return currentStatus === 'ocupado';
        return true;
    });

    const isToday = selectedDate === formatDate(new Date());

    return (
        <div className="dashboard-page">
            {/* Controles de Busca e Filtro Rápido */}
            <div className="search-filter-container">
                <div className="search-wrapper">
                    <input
                        type="text"
                        placeholder="Buscar sala por nome ou e-mail..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="filter-buttons">
                    <button 
                        onClick={() => setStatusFilter('all')} 
                        className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                    >
                        Todas
                    </button>
                    <button 
                        onClick={() => setStatusFilter('free')} 
                        className={`filter-btn ${statusFilter === 'free' ? 'active' : ''}`}
                    >
                        Livres Agora
                    </button>
                    <button 
                        onClick={() => setStatusFilter('busy')} 
                        className={`filter-btn ${statusFilter === 'busy' ? 'active' : ''}`}
                    >
                        Ocupadas Agora
                    </button>
                </div>
            </div>

            {/* Controle de Navegação de Data */}
            <div className="date-navigation">
                <button onClick={goToPreviousDay} className="nav-button">Anterior</button>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="date-picker"
                />
                <button onClick={goToNextDay} className="nav-button">Próximo</button>
                <button onClick={goToToday} className="today-button">Hoje</button>
            </div>

            {/* Renderização condicional de Loading / Esqueletos */}
            {(loading || schedules === null) ? (
                <div className="skeleton-container">
                    <div className="skeleton-header"></div>
                    <div className="skeleton-row"><div className="skeleton-left"><div className="skeleton-text title"></div><div className="skeleton-text sub"></div><div className="skeleton-text badge"></div></div><div className="skeleton-right"><div className="skeleton-track"></div></div></div>
                    <div className="skeleton-row"><div className="skeleton-left"><div className="skeleton-text title"></div><div className="skeleton-text sub"></div><div className="skeleton-text badge"></div></div><div className="skeleton-right"><div className="skeleton-track"></div></div></div>
                    <div className="skeleton-row"><div className="skeleton-left"><div className="skeleton-text title"></div><div className="skeleton-text sub"></div><div className="skeleton-text badge"></div></div><div className="skeleton-right"><div className="skeleton-track"></div></div></div>
                </div>
            ) : (
                <>
                    {filteredRooms.length === 0 ? (
                        <p style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>
                            Nenhuma sala encontrada para os filtros aplicados.
                        </p>
                    ) : (
                        <>
                            {/* Horários das Colunas (Apenas Desktop) */}
                            <div className="timeline-header-row">
                                <div className="timeline-hour-markers">
                                    {HOUR_MARKERS.map(marker => (
                                        <span 
                                            key={marker.label} 
                                            className="time-marker" 
                                            style={{ left: `${marker.position}%` }}
                                        >
                                            {marker.label}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Lista de Salas */}
                            <div className="rooms-list">
                                {filteredRooms.map(room => {
                                    const roomData = schedules[room.url];
                                    const currentStatus = getRoomCurrentStatus(roomData);
                                    const isExpanded = !!expandedRooms[room.url];

                                    return (
                                        <div key={room.url} className="room-row-container">
                                            <div className="room-row">
                                                {/* Card da Sala (Esquerda) */}
                                                <div className="room-card-panel">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                                        {room.logo_version > 0 ? (
                                                            <img 
                                                                src={`/api/rooms/${room.url}/logo?v=${room.logo_version}`} 
                                                                alt="Logo" 
                                                                className="room-logo"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    const fallback = e.target.parentElement.querySelector('.room-avatar-fallback');
                                                                    if (fallback) fallback.style.display = 'flex';
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div 
                                                            className="room-avatar-fallback" 
                                                            style={{ display: room.logo_version > 0 ? 'none' : 'flex' }}
                                                        >
                                                            {room.nome ? room.nome.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                        <div className="room-info-top" style={{ margin: 0 }}>
                                                            <h3 style={{ margin: 0 }}>{room.nome}</h3>
                                                            <div className="room-email">{room.url}</div>
                                                        </div>
                                                    </div>
                                                     <div className={`room-status-badge status-${currentStatus}`}>
                                                         <span className="status-dot"></span>
                                                         {getStatusText(currentStatus)}
                                                     </div>
                                                     {(() => {
                                                         if (currentStatus !== 'ocupado') return null;
                                                         const progress = getMeetingProgress(roomData?.status);
                                                         if (!progress) return null;
                                                         return (
                                                             <div className="meeting-progress-container">
                                                                 <div className="progress-bar-bg">
                                                                     <div className="progress-bar-fill" style={{ width: `${progress.percentage}%` }}></div>
                                                                 </div>
                                                                 <span className="progress-text">Faltam {progress.timeLeft} min para liberar</span>
                                                             </div>
                                                         );
                                                     })()}
                                                     <button 
                                                         onClick={() => toggleExpandRoom(room.url)} 
                                                         className="mobile-expand-btn"
                                                     >
                                                        {isExpanded ? 'Ocultar Horários' : 'Ver Horários'}
                                                    </button>
                                                </div>

                                                {/* Track da Timeline Gantt (Direita - Apenas Desktop) */}
                                                <div className="timeline-track-panel">
                                                    <div className="timeline-track">
                                                        {/* Indicador de Tempo Atual */}
                                                        {isToday && nowPosition !== null && (
                                                            <div 
                                                                className="live-time-indicator" 
                                                                style={{ left: `${nowPosition}%` }}
                                                                title="Hora Atual"
                                                            ></div>
                                                        )}

                                                        {/* Desenha as 24 Células de Horário */}
                                                        {TIME_SLOTS.map(slot => {
                                                            const status = roomData?.status?.[slot] || 'indisponivel';
                                                            return (
                                                                <div 
                                                                    key={slot} 
                                                                    className={`timeline-slot status-${status}`}
                                                                    title={`${slot} - ${getStatusText(status)}`}
                                                                ></div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Visão de Grade de Horários (Apenas Mobile - Expansível) */}
                                            {isExpanded && (
                                                <div className="mobile-slots-grid">
                                                    {TIME_SLOTS.map(slot => {
                                                        const status = roomData?.status?.[slot] || 'indisponivel';
                                                        return (
                                                            <div 
                                                                key={slot} 
                                                                className={`mobile-slot status-${status}`}
                                                            >
                                                                <div>{slot}</div>
                                                                <div style={{ fontSize: '9px', opacity: 0.8 }}>
                                                                    {getStatusText(status)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default DashboardPage;
