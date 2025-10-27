import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

test('renders admin page title', () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
  // Simulate navigating to the admin page
  window.history.pushState({}, 'Admin Page', '/admin');

  const titleElement = screen.getByText(/Administração de Salas/i);
  expect(titleElement).toBeInTheDocument();
});
