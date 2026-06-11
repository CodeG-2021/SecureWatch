import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { listNotifications, type Notification } from "../lib/api"
import { isAuthenticated } from "../lib/session"

interface NotificationCtxValue {
  notifications: Notification[]
  unreadCount:   number
  refresh:       () => void
}

const NotificationCtx = createContext<NotificationCtxValue>({
  notifications: [],
  unreadCount:   0,
  refresh:       () => {},
})

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    if (!isAuthenticated()) return
    try {
      const data = await listNotifications()
      if (mountedRef.current) setNotifications(data.notifications)
    } catch {}
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    const id = setInterval(refresh, 30_000)
    return () => {
      mountedRef.current = false
      clearInterval(id)
    }
  }, [refresh])

  const unreadCount = notifications.filter(n => !n.read_at).length

  return (
    <NotificationCtx.Provider value={{ notifications, unreadCount, refresh }}>
      {children}
    </NotificationCtx.Provider>
  )
}

export const useNotifications = () => useContext(NotificationCtx)
