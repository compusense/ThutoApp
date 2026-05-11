
'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface AppStateContextType {
  isNavigating: boolean;
  setIsNavigating: (isNavigating: boolean) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider = ({ children }: { children: React.ReactNode }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const value = useMemo(
    () => ({ isNavigating, setIsNavigating }),
    [isNavigating]
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
