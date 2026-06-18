import { AuthProvider, useAuth } from "@/lib/auth-context";
import AuthPage from "@/components/pages/AuthPage";
import ChatApp from "@/components/pages/ChatApp";

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-height bg-[#0a0a1a] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-white/30 text-sm">Loading...</p>
      </div>
    );
  }

  return user ? <ChatApp /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
