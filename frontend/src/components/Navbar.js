import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-container">
                <NavLink to="/" className="navbar-logo">
                    Monitor de Salas
                </NavLink>
                <ul className="nav-menu">
                    <li className="nav-item">
                        <NavLink to="/" className={({ isActive }) => "nav-links" + (isActive ? " activated" : "")}>
                            Visualização
                        </NavLink>
                    </li>
                    <li className="nav-item">
                        <NavLink to="/admin" className={({ isActive }) => "nav-links" + (isActive ? " activated" : "")}>
                            Administração
                        </NavLink>
                    </li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;
