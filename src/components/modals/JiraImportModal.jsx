import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useJira } from '../../hooks/useJira.js';
import { parseGanttConfig } from '../../utils/ganttConfig.js';

// Helper to get/save field mappings from localStorage
const FIELD_MAPPINGS_KEY = 'jira_field_mappings';
const getStoredFieldMappings = () => {
  try {
    return JSON.parse(localStorage.getItem(FIELD_MAPPINGS_KEY) || '{}');
  } catch {
    return {};
  }
};
const saveFieldMapping = (cloudId, projectKey, mapping) => {
  const all = getStoredFieldMappings();
  const key = `${cloudId}:${projectKey}`;
  all[key] = mapping;
  localStorage.setItem(FIELD_MAPPINGS_KEY, JSON.stringify(all));
};
const getFieldMapping = (cloudId, projectKey) => {
  const all = getStoredFieldMappings();
  return all[`${cloudId}:${projectKey}`] || null;
};

export default function JiraImportModal({ isOpen, onClose, onImport }) {
  const { isAuthenticated, login } = useAuth();
  const { loading, error, getResources, getProjects, getEpics, getFields, getEpicDetails } = useJira();

  const [resources, setResources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [epics, setEpics] = useState([]);

  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedEpics, setSelectedEpics] = useState(new Set());
  const [filterText, setFilterText] = useState('');

  const [step, setStep] = useState('resource'); // resource, project, fields, epics
  const [importing, setImporting] = useState(false);

  // Field mapping state
  const [dateFields, setDateFields] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({
    startDateField: '',
    endDateField: '',
  });

  // Load resources on mount when authenticated
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadResources();
    }
  }, [isOpen, isAuthenticated]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('resource');
      setSelectedResource(null);
      setSelectedProject(null);
      setSelectedEpics(new Set());
      setFilterText('');
      setProjects([]);
      setEpics([]);
      setImporting(false);
      setDateFields([]);
      setFieldMapping({ startDateField: '', endDateField: '' });
    }
  }, [isOpen]);

  const loadResources = async () => {
    const data = await getResources();
    setResources(data);
    if (data.length === 1) {
      // Auto-select if only one resource
      handleResourceSelect(data[0]);
    }
  };

  const handleResourceSelect = async (resource) => {
    setSelectedResource(resource);
    setStep('project');
    const data = await getProjects(resource.id);
    setProjects(data);
  };

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);

    // Load available date fields with sample values from this project
    const fields = await getFields(selectedResource.id, project.key);
    setDateFields(fields);

    // Check for saved field mapping
    const savedMapping = getFieldMapping(selectedResource.id, project.key);
    if (savedMapping) {
      setFieldMapping(savedMapping);
    } else {
      // Try to auto-detect common field names
      const startField = fields.find(f =>
        f.name.toLowerCase().includes('start') && f.name.toLowerCase().includes('date')
      );
      const endField = fields.find(f =>
        f.name.toLowerCase() === 'due date' || f.id === 'duedate'
      ) || fields.find(f =>
        f.name.toLowerCase().includes('end') && f.name.toLowerCase().includes('date')
      );

      setFieldMapping({
        startDateField: startField?.id || '',
        endDateField: endField?.id || 'duedate',
      });
    }

    setStep('fields');
  };

  const handleFieldsConfirm = async () => {
    // Save the field mapping for this project
    saveFieldMapping(selectedResource.id, selectedProject.key, fieldMapping);

    // Now load epics
    setStep('epics');
    setFilterText('');
    const data = await getEpics(selectedResource.id, selectedProject.key);
    setEpics(data);
    // Start with none selected
    setSelectedEpics(new Set());
  };

  // Filter epics based on search text
  const filteredEpics = epics.filter((epic) => {
    if (!filterText) return true;
    const search = filterText.toLowerCase();
    return (
      epic.key.toLowerCase().includes(search) ||
      epic.summary.toLowerCase().includes(search) ||
      epic.status?.toLowerCase().includes(search)
    );
  });

  const toggleEpicSelection = (epicKey) => {
    const newSelected = new Set(selectedEpics);
    if (newSelected.has(epicKey)) {
      newSelected.delete(epicKey);
    } else {
      newSelected.add(epicKey);
    }
    setSelectedEpics(newSelected);
  };

  const handleImport = async () => {
    try {
      setImporting(true);

      // Fetch full epic details with nested children from API
      const epicKeys = Array.from(selectedEpics);
      const fullEpicData = await getEpicDetails(selectedResource.id, epicKeys, fieldMapping);

      if (!fullEpicData || fullEpicData.length === 0) {
        console.error('No epic data returned');
        return;
      }

      // Collect report data
      const report = [];

      // Helper to transform a JIRA issue to our format (recursive)
      const transformIssue = (issue, depth = 0) => {
        const config = parseGanttConfig(issue.description) || {};

        const finalStartDate = issue.startDate || config.startDate;
        const finalEndDate = issue.endDate || config.endDate;

        // Add to report
        report.push({
          key: issue.key,
          name: issue.summary?.substring(0, 40),
          startDate: finalStartDate || '-',
          endDate: finalEndDate || '-',
          team: config.team || '-',
          fe: config.feEffortDays ?? '-',
          be: config.beEffortDays ?? '-',
        });

        return {
          id: issue.key,
          key: issue.key,
          name: issue.summary,
          description: issue.description,
          status: issue.status,
          issueType: issue.issueType,
          startDate: finalStartDate,
          endDate: finalEndDate,
          team: config.team,
          segments: config.segments || [],
          feEffortDays: config.feEffortDays,
          beEffortDays: config.beEffortDays,
          dependencies: issue.dependencies || [],
          subtasks: (issue.children || []).map(child => transformIssue(child, depth + 1)),
        };
      };

      const importData = fullEpicData.map((epic) => transformIssue(epic));

      // Print summary report
      console.log('\n📋 JIRA IMPORT REPORT');
      console.log('='.repeat(100));
      console.table(report);

      const withStart = report.filter(r => r.startDate !== '-').length;
      const withEnd = report.filter(r => r.endDate !== '-').length;
      const withBothDates = report.filter(r => r.startDate !== '-' && r.endDate !== '-').length;
      console.log(`\nSummary: ${report.length} items | ${withStart} with start date | ${withEnd} with end date | ${withBothDates} with both dates`);
      console.log('='.repeat(100));

      onImport({
        tasks: importData,
        cloudId: selectedResource.id,
        projectKey: selectedProject.key,
        fieldMapping,
      });
      onClose();
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Import from JIRA</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!isAuthenticated ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">Connect your Atlassian account to import directly from JIRA</p>
              <button
                onClick={login}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Connect Atlassian
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
              <span className="ml-2 text-gray-600">Loading...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <button onClick={loadResources} className="text-blue-600 hover:underline">
                Retry
              </button>
            </div>
          ) : step === 'resource' ? (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Select Atlassian Site</h3>
              <div className="space-y-2">
                {resources.map((resource) => (
                  <button
                    key={resource.id}
                    onClick={() => handleResourceSelect(resource)}
                    className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 text-left"
                  >
                    {resource.avatarUrl && (
                      <img src={resource.avatarUrl} alt="" className="w-8 h-8 rounded" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{resource.name}</div>
                      <div className="text-sm text-gray-500">{resource.url}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : step === 'project' ? (
            <div>
              <button
                onClick={() => setStep('resource')}
                className="text-sm text-blue-600 hover:underline mb-3"
              >
                &larr; Back to sites
              </button>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Select Project</h3>
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleProjectSelect(project)}
                    className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 text-left"
                  >
                    {project.avatarUrl && (
                      <img src={project.avatarUrl} alt="" className="w-8 h-8 rounded" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{project.name}</div>
                      <div className="text-sm text-gray-500">{project.key}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : step === 'fields' ? (
            <div>
              <button
                onClick={() => setStep('project')}
                className="text-sm text-blue-600 hover:underline mb-3"
              >
                &larr; Back to projects
              </button>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Configure Date Fields</h3>
              <p className="text-sm text-gray-500 mb-4">
                Select which JIRA fields map to Start Date and End Date. This is saved per project.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date Field
                  </label>
                  <select
                    value={fieldMapping.startDateField}
                    onChange={(e) => setFieldMapping(prev => ({ ...prev, startDateField: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- None --</option>
                    {dateFields.map(field => (
                      <option key={field.id} value={field.id}>
                        {field.name}{field.custom ? ' (custom)' : ''}{field.sample ? ` → e.g. ${field.sample}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date / Due Date Field
                  </label>
                  <select
                    value={fieldMapping.endDateField}
                    onChange={(e) => setFieldMapping(prev => ({ ...prev, endDateField: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- None --</option>
                    {dateFields.map(field => (
                      <option key={field.id} value={field.id}>
                        {field.name}{field.custom ? ' (custom)' : ''}{field.sample ? ` → e.g. ${field.sample}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleFieldsConfirm}
                className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Continue to Epic Selection
              </button>
            </div>
          ) : step === 'epics' ? (
            <div>
              <button
                onClick={() => setStep('fields')}
                className="text-sm text-blue-600 hover:underline mb-3"
              >
                &larr; Back to field config
              </button>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">
                  Select Epics to Import ({selectedEpics.size} selected)
                </h3>
              </div>
              {/* Filter input */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Filter by key, name, or status..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="space-y-2">
                {epics.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No epics found in this project</p>
                ) : filteredEpics.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No epics match your filter</p>
                ) : (
                  filteredEpics.map((epic) => (
                    <label
                      key={epic.key}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEpics.has(epic.key)}
                        onChange={() => toggleEpicSelection(epic.key)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{epic.key}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded">
                            {epic.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 truncate">{epic.summary}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {step === 'epics' && (
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedEpics.size === 0 || importing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              )}
              {importing
                ? 'Importing...'
                : selectedEpics.size === 0
                  ? 'Select Epics to Import'
                  : `Import ${selectedEpics.size} Epic${selectedEpics.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
