import Sidebar from './Sidebar';
import Navbar  from './Navbar';

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface-950">
      <Sidebar />
      <Navbar  />
      <main className="ml-[var(--sidebar-width)] pt-16 min-h-screen">
        <div className="p-6 max-w-6xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
