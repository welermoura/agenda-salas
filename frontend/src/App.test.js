import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

test('renders dashboard page title', () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
  // Procura pelo título "Dashboard" na página inicial
  const linkElement = screen.getByText(/Dashboard de Salas/i);
  expect(linkElement).toBeInTheDocument();
});
