// frontend/src/pages/LogsPage.js
import React, { useState, useEffect } from 'react';
import logService from '../services/logService';

const LogsPage = () => {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        logService.getLogs().then(data => {
            setLogs(data);
        });
    }, []);

    return (
        <div>
            <h1>Logs de Auditoria</h1>
            <pre>
                {logs.join('')}
            </pre>
        </div>
    );
};

export default LogsPage;
