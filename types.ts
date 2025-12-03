
export enum ToolType {
  SELECT = 'SELECT',
  RECTANGLE = 'RECTANGLE',
  CIRCLE = 'CIRCLE'
}

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: number;
  type: ToolType;
  start: Point;
  end: Point;
  comment: string;
  timestamp?: number; // For video
  color: string;
}

export interface Slide {
  id: string;
  type: 'image' | 'video';
  src: string;
  thumbnail?: string;
  name: string;
  annotations: Annotation[];
  createdAt: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isDemo: boolean;
}

export interface IntegrationConfig {
  jiraUrl?: string; // e.g., https://your-domain.atlassian.net
  jiraEmail?: string;
  jiraToken?: string;
  clickUpToken?: string;
  clickUpListId?: string; // Selected List ID
  clickUpListName?: string; // Name of selected list for UI
  slackWebhook?: string; // Deprecated in favor of token
  slackToken?: string; // Bot User OAuth Token (xoxb-...)
  slackChannel?: string; // Channel ID (C123456)
  
  // Teams Configuration
  teamsWebhookUrl?: string; // Incoming Webhook URL
  teamsToken?: string; // @deprecated - Legacy Graph API
  teamsTeamId?: string; // @deprecated - Legacy Graph API
  teamsChannelId?: string; // @deprecated - Legacy Graph API
  
  asanaToken?: string; // Asana Personal Access Token
  asanaWorkspaceId?: string; // Default Workspace ID
  
  // Trello Configuration
  trelloApiKey?: string;
  trelloToken?: string;
  
  webhookUrl?: string; // Custom Webhook URL
  zohoToken?: string; // Zoho Projects OAuth Token
  zohoDC?: string; // Zoho Data Center (eu, com, etc.)
  zohoSprintsToken?: string; // Zoho Sprints OAuth Token
  zohoSprintsDC?: string; // Zoho Sprints Data Center
  googleDriveToken?: string; // Google Drive Access Token for Backup

  // Scheduled Reporting
  scheduleEnabled?: boolean;
  scheduleTime?: string; // "09:00" (24h format)
  scheduleDays?: number[]; // [1, 2, 3, 4, 5] (Mon-Fri, 0=Sun)
  schedulePlatform?: 'Slack' | 'Teams';
  lastScheduleRun?: string; // ISO Date string of last successful run
}

export enum AppView {
  LOGIN = 'LOGIN',
  EDITOR = 'EDITOR',
  DASHBOARD = 'DASHBOARD',
  INTEGRATIONS = 'INTEGRATIONS'
}

export interface IssueMetric {
  status: string;
  count: number;
  fill: string;
}

export type IntegrationSource = 'ClickUp' | 'Jira' | 'Slack' | 'Teams' | 'Asana' | 'Trello' | 'Webhook' | 'Zoho' | 'ZohoSprints' | 'GoogleDrive';

export interface ReportedIssue {
  id: string;
  title: string;
  platform: IntegrationSource;
  status: string;
  statusColor?: string;
  priority: 'Urgent' | 'High' | 'Normal' | 'Low' | 'None';
  date: string;
  assignee?: string;
  dueDate?: string;
  url?: string;
  // Analytics fields
  module?: string;
  reporter?: string;
  resolutionTime?: number; // Hours
  tags?: string[];
}

export type ClickUpExportMode = 'current' | 'all_attachments' | 'all_subtasks' | 'attach_to_task';
export type SlackExportMode = 'current' | 'all_files' | 'thread';
export type JiraExportMode = 'current' | 'all_attachments';
export type TeamsExportMode = 'current' | 'summary';
export type AsanaExportMode = 'current' | 'all_attachments';
export type TrelloExportMode = 'current' | 'all_attachments';
export type WebhookExportMode = 'current' | 'all_attachments';
export type ZohoExportMode = 'current' | 'all_attachments';
export type ZohoSprintsExportMode = 'current' | 'all_attachments';

// New Video Recording Types
export type CaptureMode = 'screenshot' | 'video' | 'floating';

// ClickUp Hierarchy Types
export interface ClickUpHierarchyList {
    id: string;
    name: string;
    groupName: string; // "Space Name > Folder Name"
}

// Jira Types
export interface JiraProject {
  id: string;
  key: string;
  name: string;
  avatarUrls?: {
    '48x48': string;
  };
}

export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  subtask: boolean;
}

// Asana Types
export interface AsanaWorkspace {
  gid: string;
  name: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
}

// Trello Types
export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

export interface TrelloList {
  id: string;
  name: string;
}

// Zoho Types
export interface ZohoPortal {
    id: string;
    name: string;
}
export interface ZohoProject {
    id: string;
    name: string;
}

// Zoho Sprints Types
export interface ZohoSprintsTeam {
    id: string;
    name: string;
}
export interface ZohoSprintsProject {
    id: string;
    name: string;
}
export interface ZohoSprintsItemType {
    id: string;
    name: string;
}

// Dashboard Filters
export interface DashboardFilter {
  status?: string[];
  priority?: string[];
  dateRange?: '24h' | '7d' | '30d' | 'all';
  assignee?: string;
}

export type SortField = 'date' | 'priority' | 'status';
export type SortOrder = 'asc' | 'desc';

declare global {
  interface Window {
    documentPictureInPicture: {
      requestWindow(options: { width: number; height: number }): Promise<Window>;
      window: Window | null;
      onenter: ((ev: Event) => any) | null;
    };
    google?: any;
  }
}
