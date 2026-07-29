import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '../../src/Dashboard';

describe('Dashboard Component', () => {
  const mockOnStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the dashboard title', () => {
    render(<Dashboard onStart={mockOnStart} />);
    expect(screen.getByText('TOEIC Practice Exam')).toBeInTheDocument();
  });

  it('should render question count options', () => {
    render(<Dashboard onStart={mockOnStart} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200 (Full)')).toBeInTheDocument();
  });

  it('should render source options', () => {
    render(<Dashboard onStart={mockOnStart} />);
    expect(screen.getByText('Random Shuffle')).toBeInTheDocument();
    expect(screen.getByText('Web-Sourced Content')).toBeInTheDocument();
    expect(screen.getByText('Self Import')).toBeInTheDocument();
  });

  it('should select question count when clicked', () => {
    render(<Dashboard onStart={mockOnStart} />);
    const button = screen.getByText('20');
    fireEvent.click(button);
    expect(button).toHaveClass('bg-blue-600');
  });

  it('should select source when clicked', () => {
    render(<Dashboard onStart={mockOnStart} />);
    const webSourceButton = screen.getByText('Web-Sourced Content').closest('button');
    fireEvent.click(webSourceButton!);
    expect(webSourceButton).toHaveClass('border-blue-600');
  });

  it('should open settings panel when START EXAM clicked', () => {
    render(<Dashboard onStart={mockOnStart} />);
    const startButton = screen.getByText('START EXAM');
    fireEvent.click(startButton);
    expect(screen.getByText('AI Configuration')).toBeInTheDocument();
  });

  it('should show API key input in settings', () => {
    render(<Dashboard onStart={mockOnStart} />);
    const startButton = screen.getByText('START EXAM');
    fireEvent.click(startButton);
    const apiKeyInput = screen.getByPlaceholderText(/API Key/i);
    expect(apiKeyInput).toBeInTheDocument();
  });
});
