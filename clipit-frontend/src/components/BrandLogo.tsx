import clipitLogo from '../assets/clipitlogo.png';

interface BrandLogoProps {
  className?: string;
}

/** The shared ClipIt wordmark used in the signed-in app and public shell. */
export function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <div className={`flex items-center ${className}`.trim()}>
      <img src={clipitLogo} alt="" className="-mt-2 h-12 w-12 shrink-0 object-contain" />
      <span
        className="-ml-1 text-4xl leading-none tracking-tight"
        style={{ fontFamily: "'Love Ya Like A Sister', cursive", WebkitTextStroke: '2px #9E3B3B', paintOrder: 'stroke fill' }}
      >
        <span style={{ color: '#EA7B7B' }}>lip</span><span style={{ color: '#FFEAD3' }}>It</span>
      </span>
    </div>
  );
}
