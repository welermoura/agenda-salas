// frontend/src/services/userService.js
const API_URL = '/api';

const getUsers = async () => {
    const response = await fetch(`${API_URL}/users`);
    return response.json();
};

export default {
    getUsers,
};
