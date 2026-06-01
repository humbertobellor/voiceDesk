import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo } from '@/components/ui/Logo';

describe('Logo Component', () => {
  describe('Sizing', () => {
    it('renders with xs size (w-6 h-6)', () => {
      render(<Logo size="xs" />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('w-6');
      expect(img.className).toContain('h-6');
    });

    it('renders with sm size (w-8 h-8)', () => {
      render(<Logo size="sm" />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('w-8');
      expect(img.className).toContain('h-8');
    });

    it('renders with md size (w-10 h-10)', () => {
      render(<Logo size="md" />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('w-10');
      expect(img.className).toContain('h-10');
    });

    it('renders with lg size (w-12 h-12)', () => {
      render(<Logo size="lg" />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('w-12');
      expect(img.className).toContain('h-12');
    });

    it('allows custom className override', () => {
      render(<Logo size="md" className="custom-class" />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('custom-class');
      expect(img.className).toContain('w-10');
      expect(img.className).toContain('h-10');
    });
  });

  describe('Alt text', () => {
    it('uses default alt text "Koolable logo"', () => {
      render(<Logo />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('alt')).toBe('Koolable logo');
    });

    it('accepts custom alt text', () => {
      render(<Logo alt="Custom logo text" />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('alt')).toBe('Custom logo text');
    });
  });

  describe('Variant', () => {
    it('renders default variant from /logo.svg', () => {
      render(<Logo variant="default" />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('src')).toBe('/logo.svg');
    });

    it('renders white variant from /logo-white.svg', () => {
      render(<Logo variant="white" />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('src')).toBe('/logo-white.svg');
    });
  });

  describe('Accessibility', () => {
    it('includes aria-label for screen readers', () => {
      render(<Logo />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('aria-label')).toBe('Koolable logo');
    });

    it('has alt text on img element', () => {
      render(<Logo />);
      const img = screen.getByRole('img');
      const altText = img.getAttribute('alt');
      expect(altText).toBeTruthy();
      expect(altText).not.toBe('');
    });
  });
});
