export interface LogoProps {
  variant?: 'default' | 'white';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  alt?: string;
}

const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export function Logo({
  variant = 'default',
  size = 'md',
  className = '',
  alt = 'Koolable logo',
}: LogoProps): React.ReactElement {
  const logoFile = variant === 'white' ? '/logo-white.svg' : '/logo.svg';
  const sizeClasses = sizeMap[size];

  return (
    <img
      src={logoFile}
      alt={alt}
      aria-label={alt}
      className={`${sizeClasses} ${className}`}
    />
  );
}
