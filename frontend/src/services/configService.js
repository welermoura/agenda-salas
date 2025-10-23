// frontend/src/services/configService.js
const API_URL = '/api';

const getConfig = async () => {
    const response = await fetch(`${API_URL}/config`);
    if (!response.ok) {
        throw new Error('Configuração não encontrada');
    }
    return response.json();
};

const saveConfig = async (config) => {
    const response = await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    });
    if (!response.ok) {
        throw new Error('Falha ao salvar a configuração');
    }
    return response.json();
};

export default {
    getConfig,
    saveConfig,
};
