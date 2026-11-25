export interface HelpEntry {
  id: string;
  title: string;
  body: string;
  learnMoreUrl?: string;
}

const helpContent: Record<string, HelpEntry> = {
  'dashboard.overview': {
    id: 'dashboard.overview',
    title: 'Dashboard overview',
    body: 'This dashboard summarizes your key metrics. Use the filters above to narrow the data shown.',
  },
  'dashboard.metrics': {
    id: 'dashboard.metrics',
    title: 'Metrics',
    body: 'Metrics are refreshed every few minutes. Hover over a chart to see detailed values for a point in time.',
  },
  'navigation.breadcrumbs': {
    id: 'navigation.breadcrumbs',
    title: 'Breadcrumbs',
    body: 'Breadcrumbs show where you are in the app and let you jump back to any parent page.',
  },
  'search.input': {
    id: 'search.input',
    title: 'Search',
    body: 'Search across records by name, id, or tag. Press Enter to run the search or Escape to clear it.',
  },
  'settings.notifications': {
    id: 'settings.notifications',
    title: 'Notifications',
    body: 'Choose which events trigger notifications and how you would like to receive them.',
  },
  'settings.privacy': {
    id: 'settings.privacy',
    title: 'Privacy',
    body: 'Control how your data is stored and shared. Changes take effect immediately.',
  },
  'forms.required': {
    id: 'forms.required',
    title: 'Required fields',
    body: 'Fields marked with an asterisk are required and must be completed before saving.',
  },
  'reports.export': {
    id: 'reports.export',
    title: 'Export reports',
    body: 'Export the current report as CSV or PDF. Large reports may take a moment to generate.',
  },
};

export function getHelpEntry(id: string): HelpEntry | undefined {
  return helpContent[id];
}

export function listHelpEntries(): HelpEntry[] {
  return Object.values(helpContent);
}
