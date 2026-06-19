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

// Agrupa slots consecutivos do status ocupado para desenhar cápsulas (pills)
const getBusySegments = (roomStatus) => {
    if (!roomStatus) return [];
    const segments = [];
    let currentSegment = null;

    TIME_SLOTS.forEach((slot, index) => {
        const status = roomStatus[slot];
        if (status === 'ocupado') {
            if (!currentSegment) {
                currentSegment = { startSlot: slot, startIndex: index, length: 1 };
            } else {
                currentSegment.length += 1;
            }
        } else {
            if (currentSegment) {
                segments.push(currentSegment);
                currentSegment = null;
            }
        }
    });
    if (currentSegment) {
        segments.push(currentSegment);
    }
    return segments;
};

// Calcula a hora final somando 30 min por slot
const getEndTime = (startSlot, length) => {
    const [h, m] = startSlot.split(':').map(Number);
    const totalMinutes = h * 60 + m + length * 30;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

const DashboardPage = ({ theme = 'classic-light', onThemeLoaded }) => {
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

    // Refs e estados para a linha do tempo vertical (Opção 5)
    const tableContainerRef = useRef(null);
    const tbodyRef = useRef(null);
    const [lineTop, setLineTop] = useState(null);
    const [lineLeft, setLineLeft] = useState(0);
    const [lineWidth, setLineWidth] = useState(0);

    const lastScrollTimeRef = useRef(0);
    const isUserScrollingRef = useRef(false);
    const userScrollTimeoutRef = useRef(null);

    // Detectar scroll manual do usuário
    const handleContainerScroll = useCallback(() => {
        const now = Date.now();
        if (now - lastScrollTimeRef.current < 1000) {
            return;
        }

        isUserScrollingRef.current = true;
        if (userScrollTimeoutRef.current) {
            clearTimeout(userScrollTimeoutRef.current);
        }
        userScrollTimeoutRef.current = setTimeout(() => {
            isUserScrollingRef.current = false;
        }, 5000); // Volta a auto-centralizar após 5 segundos de inatividade
    }, []);

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

                if (data.theme && onThemeLoaded) {
                    onThemeLoaded(data.theme);
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

    // Função para centralizar a linha do tempo (Opção 5) no meio da tela
    const centerTimeLine = useCallback((behavior = 'smooth') => {
        const container = tableContainerRef.current;
        if (!container || lineTop === null || lineTop === 0) return;

        const header = container.querySelector('thead');
        const headerHeight = header ? header.offsetHeight : 0;
        const containerHeight = container.clientHeight;

        // O centro da área visível (excluindo o cabeçalho)
        const yCenter = headerHeight + (containerHeight - headerHeight) / 2;
        const targetScrollTop = lineTop - yCenter;

        lastScrollTimeRef.current = Date.now();
        container.scrollTo({
            top: targetScrollTop,
            behavior
        });
    }, [lineTop]);

    // Efeito para calcular a posição da linha do tempo vertical baseada em DOM (Opção 5)
    const updateLinePosition = useCallback(() => {
        if (!tbodyRef.current || !tableContainerRef.current) {
            return;
        }
        
        const isToday = selectedDate === formatDate(new Date());
        if (!isToday) {
            setLineTop(null);
            return;
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = 8 * 60;   // 08:00
        const endMinutes = 20 * 60;    // 20:00

        if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
            setLineTop(null);
            return;
        }

        const tbody = tbodyRef.current;
        const container = tableContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const tbodyRect = tbody.getBoundingClientRect();

        const hour = Math.floor(currentMinutes / 60);
        const minutes = currentMinutes % 60;
        const hourStr = `${String(hour).padStart(2, '0')}:00`;

        const hourRow = tbody.querySelector(`tr.hour-row[data-hour="${hourStr}"]`);
        if (!hourRow) {
            setLineTop(null);
            return;
        }

        const rowRect = hourRow.getBoundingClientRect();
        const rowTop = (rowRect.top - containerRect.top) + container.scrollTop;
        const rowHeight = rowRect.height;
        
        let lineTopPos = 0;
        if (hour < 19) {
            const nextHourStr = `${String(hour + 1).padStart(2, '0')}:00`;
            const nextHourRow = tbody.querySelector(`tr.hour-row[data-hour="${nextHourStr}"]`);
            if (nextHourRow) {
                const nextRowRect = nextHourRow.getBoundingClientRect();
                const nextRowTop = (nextRowRect.top - containerRect.top) + container.scrollTop;
                lineTopPos = rowTop + (minutes / 60) * (nextRowTop - rowTop);
            } else {
                lineTopPos = rowTop + (minutes / 60) * rowHeight;
            }
        } else {
            // Último slot: 19:00 às 20:00. Adiciona 8px para o espaçamento da tabela
            lineTopPos = rowTop + (minutes / 60) * (rowHeight + 8);
        }

        const left = (tbodyRect.left - containerRect.left) + container.scrollLeft;
        const width = tbodyRect.width;

        setLineTop(lineTopPos);
        setLineLeft(left);
        setLineWidth(width);

        // Atualizar variáveis CSS dinâmicas para altura responsiva dos spacers
        const containerHeight = container.clientHeight;
        const header = container.querySelector('thead');
        const headerHeight = header ? header.offsetHeight : 0;
        container.style.setProperty('--container-height', `${containerHeight}px`);
        container.style.setProperty('--header-height', `${headerHeight}px`);
    }, [selectedDate]);

    useEffect(() => {
        updateLinePosition();
        const timer = setInterval(updateLinePosition, 10000); // atualiza a cada 10 segundos
        window.addEventListener('resize', updateLinePosition);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', updateLinePosition);
        };
    }, [updateLinePosition, filteredRooms, schedules, theme, selectedDate]);

    // Centralização inicial (sem animação) ao carregar a página/data/tema
    const hasInitialCentered = useRef(false);
    useEffect(() => {
        if (lineTop !== null && lineTop !== 0 && !hasInitialCentered.current) {
            const timer = setTimeout(() => {
                centerTimeLine('auto');
                hasInitialCentered.current = true;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [lineTop, centerTimeLine]);

    useEffect(() => {
        hasInitialCentered.current = false;
    }, [selectedDate, filteredRooms, theme]);

    // Rolagem automática periódica suave se o usuário não estiver interagindo
    useEffect(() => {
        if (lineTop !== null && lineTop !== 0 && hasInitialCentered.current && !isUserScrollingRef.current) {
            centerTimeLine('smooth');
        }
    }, [lineTop, centerTimeLine]);

    return (
        <div className="dashboard-page">
            {/* Controles de Busca, Data e Filtros em uma única barra */}
            <div className="dashboard-controls-bar">
                <div className="search-wrapper">
                    <input
                        type="text"
                        placeholder="Buscar sala por nome ou e-mail..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

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
                        Livres
                    </button>
                    <button 
                        onClick={() => setStatusFilter('busy')} 
                        className={`filter-btn ${statusFilter === 'busy' ? 'active' : ''}`}
                    >
                        Ocupadas
                    </button>
                </div>
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
                        (() => {
                            const isVerticalTableTheme = theme.startsWith('steel') || theme.startsWith('desert') || theme.startsWith('toxic') || theme.startsWith('aurora');

                            if (isVerticalTableTheme) {
                                const allHours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
                                const currentHour = new Date().getHours();
                                const hoursToShow = allHours.filter(hour => {
                                    if (isToday) {
                                        const [h] = hour.split(':').map(Number);
                                        return h >= currentHour;
                                    }
                                    return true;
                                });

                                return (
                                    <div 
                                        ref={tableContainerRef} 
                                        className="vertical-availability-table-container"
                                        onScroll={handleContainerScroll}
                                    >
                                        {hoursToShow.length === 0 ? (
                                            <div className="no-hours-left-message" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: '16px' }}>
                                                <span style={{ fontSize: '32px', display: 'block', marginBottom: '16px' }}>⏰</span>
                                                Todos os horários de hoje já passaram. Selecione uma data futura para realizar agendamentos.
                                            </div>
                                        ) : (
                                            <table className="vertical-availability-table">
                                                <thead>
                                                    <tr>
                                                        <th>Horário</th>
                                                        {filteredRooms.map(room => (
                                                            <th key={room.url}>
                                                                <div className="table-header-room">
                                                                    {room.logo_version > 0 ? (
                                                                        <img 
                                                                            src={`/api/rooms/${room.url}/logo?v=${room.logo_version}`} 
                                                                            alt="" 
                                                                            className="table-room-logo"
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <span className="table-room-name">{room.nome}</span>
                                                                </div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody ref={tbodyRef}>
                                                    {hoursToShow.map(hour => {
                                                        const slot1 = hour;
                                                        const [h] = hour.split(':');
                                                        const slot2 = `${h}:30`;
                                                        return (
                                                            <tr key={hour} className="hour-row" data-hour={hour}>
                                                                <td className="time-col">{hour}</td>
                                                                {filteredRooms.map(room => {
                                                                    const roomData = schedules[room.url];
                                                                    const status1 = roomData?.status?.[slot1] || 'indisponivel';
                                                                    const status2 = roomData?.status?.[slot2] || 'indisponivel';
                                                                    return (
                                                                        <td key={room.url}>
                                                                            <div className="availability-cell-split">
                                                                                <div className={`availability-block status-${status1}`} title={`${slot1} - ${getStatusText(status1)}`}>
                                                                                    <span className="block-status-text">{getStatusText(status1)}</span>
                                                                                </div>
                                                                                <div className={`availability-block status-${status2}`} title={`${slot2} - ${getStatusText(slot2)}`}>
                                                                                    <span className="block-status-text">{getStatusText(status2)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                        
                                        {/* Linha do tempo atual vertical */}
                                        {isToday && lineTop !== null && (
                                            <div 
                                                style={{ 
                                                    top: `${lineTop}px`, 
                                                    left: `${lineLeft}px`, 
                                                    width: `${lineWidth}px` 
                                                }} 
                                                className="table-live-time-line"
                                                title="Hora Atual"
                                            ></div>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {/* Horários das Colunas (Apenas Desktop) */}
                                    {!(theme.startsWith('corporate') || theme.startsWith('plum') || theme.startsWith('steel') || theme.startsWith('sakura') || theme === 'clean-office') && (
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
                                    )}

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
                                                    {theme.startsWith('corporate') || theme.startsWith('plum') || theme.startsWith('steel') || theme.startsWith('sakura') || theme === 'clean-office' ? (
                                                        <div className="timeline-text-summary">
                                                            <div className="upcoming-meetings-list">
                                                                <span className="upcoming-title">Compromissos do Dia:</span>
                                                                {(() => {
                                                                    const segments = getBusySegments(roomData?.status);
                                                                    if (segments.length === 0) {
                                                                        return <span className="no-meetings">Sem reuniões agendadas para hoje</span>;
                                                                    }
                                                                    return (
                                                                        <div className="meetings-row">
                                                                            {segments.map(seg => {
                                                                                const start = seg.startSlot;
                                                                                const end = getEndTime(seg.startSlot, seg.length);
                                                                                return (
                                                                                    <span key={start} className="meeting-pill-text">
                                                                                        🕒 {start} - {end}
                                                                                    </span>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                     ) : theme.startsWith('ocean') || theme.startsWith('sunset') || theme.startsWith('mono') || theme.startsWith('rose') || theme.startsWith('luxury') || theme.startsWith('aurora') || theme === 'ocean-breeze' ? (
                                                        <div className="timeline-track-minimal">
                                                            <div className="timeline-minimal-line"></div>
                                                            {/* Indicador de Tempo Atual */}
                                                            {isToday && nowPosition !== null && (
                                                                <div 
                                                                    className="live-time-indicator" 
                                                                    style={{ left: `${nowPosition}%` }}
                                                                    title="Hora Atual"
                                                                ></div>
                                                            )}
                                                            {/* Desenha as Cápsulas de Reunião */}
                                                            {(() => {
                                                                const segments = getBusySegments(roomData?.status);
                                                                return segments.map(seg => {
                                                                    const left = (seg.startIndex / TIME_SLOTS.length) * 100;
                                                                    const width = (seg.length / TIME_SLOTS.length) * 100;
                                                                    const start = seg.startSlot;
                                                                    const end = getEndTime(seg.startSlot, seg.length);
                                                                    return (
                                                                        <div 
                                                                            key={seg.startSlot}
                                                                            className="timeline-busy-capsule"
                                                                            style={{ left: `${left}%`, width: `${width}%` }}
                                                                            title={`Ocupado: ${start} - ${end}`}
                                                                        >
                                                                            <span className="capsule-text">{start} - {end}</span>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    ) : (
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
                                                    )}
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
                            );
                        })())}
                </>
            )}
        </div>
    );
};

export default DashboardPage;
