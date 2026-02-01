import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import JiraImportModal from './modals/JiraImportModal';

const STEPS = [
  { id: 'login', label: 'Login' },
  { id: 'import', label: 'Import' },
];

function ProgressIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={step.id}>
            {index > 0 && (
              <div
                className={`w-12 h-0.5 ${isCompleted ? 'bg-blue-600' : 'bg-gray-300'}`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                  ${isCompleted ? 'bg-blue-600 text-white' : ''}
                  ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-gray-200 text-gray-500' : ''}
                `}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className={`text-xs ${isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
      <span className="ml-4 text-sm text-gray-400">
        Step {currentStep + 1} of {STEPS.length}
      </span>
    </div>
  );
}

function LoginStep({ onLogin }) {
  const { loading } = useAuth();

  return (
    <div className="text-center">
      <div className="text-6xl mb-6">🔐</div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-3">
        Connect Your JIRA Account
      </h2>
      <p className="text-gray-500 mb-8 max-w-md mx-auto">
        Sign in with your Atlassian account to import epics and sync schedule changes back to JIRA.
      </p>
      <button
        onClick={onLogin}
        disabled={loading}
        className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Connecting...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 8.143L8.143 11.571 11.571 15l3.429-3.429-3.429-3.428zm5.714 0L13.857 11.571l3.428 3.429 3.429-3.429-3.429-3.428zM8.143 11.571L4.714 15 8.143 18.429l3.428-3.429-3.428-3.429zm5.714 0l-3.428 3.429 3.428 3.429 3.429-3.429-3.429-3.429z" />
            </svg>
            Sign in with Atlassian
          </>
        )}
      </button>
    </div>
  );
}

function ImportStep({ onImport, onSignOut }) {
  const [showImportModal, setShowImportModal] = useState(false);
  const { user } = useAuth();

  const handleImport = (data) => {
    setShowImportModal(false);
    onImport(data);
  };

  return (
    <div className="text-center">
      <div className="text-6xl mb-6">📋</div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-3">
        Import Your Epics
      </h2>
      <p className="text-gray-500 mb-8 max-w-md mx-auto">
        Select a JIRA project and choose which epics to import into your timeline.
      </p>
      <button
        onClick={() => setShowImportModal(true)}
        className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import from JIRA
      </button>

      {/* User info and sign out */}
      <div className="mt-12 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
          {user?.picture && (
            <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />
          )}
          <span>Signed in as {user?.name || user?.email}</span>
          <button
            onClick={onSignOut}
            className="text-gray-400 hover:text-gray-600 underline"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Import Modal */}
      <JiraImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
    </div>
  );
}

export default function SetupWizard({ onComplete }) {
  const { isAuthenticated, loading, login, logout } = useAuth();

  // Determine current step based on auth state
  const currentStep = isAuthenticated ? 1 : 0;

  // Don't render until we know auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <span className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></span>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cadence</h1>
            <p className="text-sm text-gray-500">Interactive Schedule & Dependency Manager</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <ProgressIndicator currentStep={currentStep} />

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {currentStep === 0 && (
              <LoginStep onLogin={login} />
            )}
            {currentStep === 1 && (
              <ImportStep onImport={onComplete} onSignOut={logout} />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-400">
          Plan and track your project timelines with JIRA integration
        </div>
      </footer>
    </div>
  );
}
