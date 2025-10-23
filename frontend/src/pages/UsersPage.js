// frontend/src/pages/UsersPage.js
import React, { useState, useEffect } from 'react';
import userService from '../services/userService';

const UsersPage = () => {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        userService.getUsers().then(data => {
            setUsers(data);
        });
    }, []);

    return (
        <div>
            <h1>Gerenciamento de Usuários</h1>
            <ul>
                {users.map(user => (
                    <li key={user.dn}>{user.attrs.cn[0]} - {user.attrs.mail ? user.attrs.mail[0] : 'N/A'}</li>
                ))}
            </ul>
        </div>
    );
};

export default UsersPage;
