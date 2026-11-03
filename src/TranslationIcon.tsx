
export const TranslationIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      
      {/* 1. '文' (글월 문) */}
      <span 
        className="absolute font-sans font-bold leading-none select-none text-white flex items-center justify-center"
        style={{ 
          fontSize: size * 0.7, 
          // 시각적 중앙 정렬을 위해 위치 미세 조정 (왼쪽 위로)
          top: '0%', 
          left: '0%',
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 50%, 50% 100%, 0% 100%)' 
        }}
      >
        文
      </span>

      {/* 2. Sparkle (반짝임) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
        className="absolute text-white drop-shadow-sm"
        style={{ 
          width: size * 0.65, 
          height: size * 0.65,
          // 시각적 중앙 정렬을 위해 위치 미세 조정 (안쪽으로)
          bottom: '-2%', 
          right: '-2%'   
        }}
      >
        <path d="M12,2 L14.5,9.5 L22,12 L14.5,14.5 L12,22 L9.5,14.5 L2,12 L9.5,9.5 L12,2 Z" />
      </svg>

    </div>
  );
};
