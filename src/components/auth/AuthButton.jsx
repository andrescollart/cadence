import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AuthButton() {
  const { user, loading, isAuthenticated, login, logout } = useAuth();

  if (loading) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 rounded-md"
      >
        <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></span>
        Loading...
      </button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {user.picture && (
            <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />
          )}
          <span className="text-sm text-gray-600">{user.name || user.email}</span>
        </div>
        <button
          onClick={logout}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 8.143L8.143 11.571 11.571 15l3.429-3.429-3.429-3.428zm5.714 0L13.857 11.571l3.428 3.429 3.429-3.429-3.429-3.428zM8.143 11.571L4.714 15 8.143 18.429l3.428-3.429-3.428-3.429zm5.714 0l-3.428 3.429 3.428 3.429 3.429-3.429-3.429-3.429z" />
      </svg>
      Connect Atlassian
    </button>
  );
}
