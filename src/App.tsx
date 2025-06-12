import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { ChatInterface } from "./ChatInterface";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <header className="sticky top-0 z-10 glass-dark h-16 flex justify-between items-center border-b border-gray-700 px-4">
        <h2 className="text-xl font-semibold text-purple-400">
          ChatGPT Clone
        </h2>
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      <main className="flex-1">
        <Content />
      </main>
      <Toaster 
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          },
        }}
      />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (!loggedInUser) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <Authenticated>
        <ChatInterface />
      </Authenticated>
      <Unauthenticated>
        <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg-primary)' }}>
          <div className="w-full max-w-md mx-auto p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-purple-400 mb-4">
                Welcome to ChatGPT Clone
              </h1>
              <p className="text-xl text-gray-300">Sign in to start chatting with AI</p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}
