export interface LogoProps {
  variant?: 'default' | 'white';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  alt?: string;
}

const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl', string> = {
  xs: 'w-8 h-8',
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
  xl: 'w-64 h-32',
  '2xl': 'w-[172px] h-[39px]',
};

export function Logo({
  variant = 'default',
  size = 'md',
  className = '',
  alt = 'Koolable logo',
}: LogoProps): React.ReactElement {
  const logoFile = variant === 'white' ? '/logo-white.svg' : '/main-logo-trans.png';
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
