import { render, screen } from '@testing-library/react';
import App from './App';

test('renders welcome message', () => {
  render(<App />);
  const welcomeElement = screen.getByText(/Bem-vindo à Ferramenta de Gestão de Active Directory/i);
  expect(welcomeElement).toBeInTheDocument();
});
