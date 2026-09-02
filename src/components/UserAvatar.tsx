import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  className?: string;
  sizeClassName?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoURL,
  displayName,
  className = "rounded-full border-[1.5px] border-white/20 shadow-sm shrink-0",
  sizeClassName = "w-7 h-7 text-[10px]"
}) => {
  const [imageError, setImageError] = useState(false);

  if (photoURL && !imageError) {
    return (
      <img
        src={photoURL}
        alt={displayName || "User avatar"}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setImageError(true)}
        className={`${sizeClassName} ${className} object-cover`}
      />
    );
  }

  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : null;

  return (
    <div
      className={`${sizeClassName} ${className} bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-bold shadow-sm select-none`}
    >
      {initial ? initial : <User className="w-3.5 h-3.5 text-white/90" />}
    </div>
  );
};
