import React from 'react';

interface UserAvatarProps {
  name: { en: string; bn?: string } | string;
  photo?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  role?: string;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ name, photo, size = 'md', role, className = '' }) => {
  const enName = typeof name === 'string' ? name : name.en;
  const initials = enName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold'
  }[size];

  // Role color accents
  const roleBg = {
    TRUSTEE: 'bg-amber-800 text-amber-100 border border-amber-600',
    CEO: 'bg-red-900 text-red-100 border border-red-700',
    DEPT_HEAD: 'bg-blue-900 text-blue-100 border border-blue-700',
    OFFICER: 'bg-teal-900 text-teal-100 border border-teal-700',
    STAFF: 'bg-slate-800 text-slate-200 border border-slate-600',
    CONTRACTUAL: 'bg-zinc-800 text-zinc-300 border border-zinc-600'
  }[role || ''] || 'bg-slate-700 text-slate-100 border border-slate-600';

  if (photo) {
    return (
      <img
        src={photo}
        alt={enName}
        className={`${sizeClasses} rounded-full object-cover shrink-0 shadow-sm ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} ${roleBg} rounded-full flex items-center justify-center shrink-0 tracking-wider select-none font-medium shadow-sm ${className}`}
      title={enName}
    >
      {initials || 'U'}
    </div>
  );
};
