'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type SidebarContextValue = {
  isCollapsed: boolean
  toggleCollapse: () => void
  setCollapsed: (collapsed: boolean) => void
  isMobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed)
  }, [])

  const openMobile = useCallback(() => {
    setIsMobileOpen(true)
  }, [])

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      isCollapsed,
      toggleCollapse,
      setCollapsed,
      isMobileOpen,
      openMobile,
      closeMobile,
    }),
    [isCollapsed, toggleCollapse, setCollapsed, isMobileOpen, openMobile, closeMobile],
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
