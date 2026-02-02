import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Hook for interacting with JIRA API
 */
export function useJira() {
  const { isAuthenticated, refreshToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to make authenticated API calls with auto-refresh
  const fetchWithAuth = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, options);

      // If unauthorized, try to refresh and retry
      if (response.status === 401) {
        await refreshToken();
        return fetch(url, options);
      }

      return response;
    },
    [refreshToken]
  );

  // Get accessible Atlassian sites
  const getResources = useCallback(async () => {
    if (!isAuthenticated) return [];

    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/jira/resources');
      if (!response.ok) throw new Error('Failed to fetch resources');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchWithAuth]);

  // Get projects for a cloud site
  const getProjects = useCallback(
    async (cloudId) => {
      if (!isAuthenticated || !cloudId) return [];

      setLoading(true);
      setError(null);

      try {
        const response = await fetchWithAuth(`/api/jira/projects?cloudId=${cloudId}`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        return await response.json();
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, fetchWithAuth]
  );

  // Get epics for a project
  const getEpics = useCallback(
    async (cloudId, projectKey) => {
      if (!isAuthenticated || !cloudId || !projectKey) return [];

      setLoading(true);
      setError(null);

      try {
        const response = await fetchWithAuth(
          `/api/jira/epics?cloudId=${cloudId}&projectKey=${projectKey}`
        );
        if (!response.ok) throw new Error('Failed to fetch epics');
        return await response.json();
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, fetchWithAuth]
  );

  // Get available date fields for a cloud site (with optional sample values)
  const getFields = useCallback(
    async (cloudId, projectKey = null) => {
      if (!isAuthenticated || !cloudId) return [];

      try {
        let url = `/api/jira/fields?cloudId=${cloudId}`;
        if (projectKey) {
          url += `&projectKey=${projectKey}`;
        }
        const response = await fetchWithAuth(url);
        if (!response.ok) throw new Error('Failed to fetch fields');
        return await response.json();
      } catch (err) {
        console.error('Failed to fetch fields:', err);
        return [];
      }
    },
    [isAuthenticated, fetchWithAuth]
  );

  // Get full epic details with nested children (for import)
  const getEpicDetails = useCallback(
    async (cloudId, epicKeys, fieldMapping = {}) => {
      if (!isAuthenticated || !cloudId || !epicKeys.length) return [];

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          cloudId,
          epicKeys: epicKeys.join(','),
        });
        if (fieldMapping.startDateField) {
          params.append('startDateField', fieldMapping.startDateField);
        }
        if (fieldMapping.endDateField) {
          params.append('endDateField', fieldMapping.endDateField);
        }

        const response = await fetchWithAuth(`/api/jira/epic-details?${params}`);
        if (!response.ok) throw new Error('Failed to fetch epic details');
        return await response.json();
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, fetchWithAuth]
  );

  // Get available issue link types
  const getLinkTypes = useCallback(
    async (cloudId) => {
      if (!isAuthenticated || !cloudId) return [];

      try {
        const response = await fetchWithAuth(`/api/jira/links?cloudId=${cloudId}`);
        if (!response.ok) throw new Error('Failed to fetch link types');
        return await response.json();
      } catch (err) {
        console.error('Failed to fetch link types:', err);
        return [];
      }
    },
    [isAuthenticated, fetchWithAuth]
  );

  // Create an issue link (dependency)
  const createIssueLink = useCallback(
    async (cloudId, linkType, inwardIssue, outwardIssue) => {
      if (!isAuthenticated) return { success: false, error: 'Not authenticated' };

      try {
        const response = await fetchWithAuth('/api/jira/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cloudId, linkType, inwardIssue, outwardIssue }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create link');
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [isAuthenticated, fetchWithAuth]
  );

  // Delete an issue link
  const deleteIssueLink = useCallback(
    async (cloudId, linkId) => {
      if (!isAuthenticated) return { success: false, error: 'Not authenticated' };

      try {
        const response = await fetchWithAuth(
          `/api/jira/links?cloudId=${cloudId}&linkId=${linkId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete link');
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [isAuthenticated, fetchWithAuth]
  );

  // Sync config back to JIRA
  const syncToJira = useCallback(
    async (cloudId, issueKey, config) => {
      if (!isAuthenticated) return { success: false, error: 'Not authenticated' };

      setLoading(true);
      setError(null);

      try {
        const response = await fetchWithAuth('/api/jira/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cloudId, issueKey, config }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Sync failed');
        }

        return { success: true };
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, fetchWithAuth]
  );

  return {
    loading,
    error,
    getResources,
    getProjects,
    getEpics,
    getFields,
    getEpicDetails,
    syncToJira,
    getLinkTypes,
    createIssueLink,
    deleteIssueLink,
  };
}

export default useJira;
