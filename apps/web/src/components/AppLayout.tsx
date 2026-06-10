import { Sidebar } from "./Sidebar"

interface AppLayoutProps {
  children: React.ReactNode
}

/** Shared shell used by every protected page: dark sidebar + scrollable content area. */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
