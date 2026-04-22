interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-lg' };
const dotSizes = { xs: 'w-1.5 h-1.5', sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3', xl: 'w-3.5 h-3.5' };

const colors = ['bg-violet-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500'];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function Avatar({ name, src, size = 'md', online, className = '' }: AvatarProps) {
  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      {src ? (
        <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover`} />
      ) : (
        <div className={`${sizes[size]} ${getColor(name)} rounded-full flex items-center justify-center text-white font-semibold`}>
          {getInitials(name)}
        </div>
      )}
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 ${dotSizes[size]} rounded-full border-2 border-white ${online ? 'bg-green-400' : 'bg-gray-300'}`} />
      )}
    </div>
  );
}
