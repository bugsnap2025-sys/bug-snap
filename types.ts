
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
  jiraUrl?: string;
  jiraEmail?: string;
  jiraToken?: string;
  clickUpToken?: string;
  clickUpListId?: string; // Selected List ID
  clickUpListName?: string; // Name of selected list for UI
  slackWebhook?: string; // Deprecated in favor of token
  slackToken?: string; // Bot User OAuth Token (xoxb-...)
  slackChannel?: string; // Channel ID (C123456)
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

export type IntegrationSource = 'ClickUp' | 'Jira' | 'Slack';

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

export type ClickUpExportMode = 'current' | 'all_attachments' | 'all_subtasks';
export type SlackExportMode = 'current' | 'all_files' | 'thread';

// New Video Recording Types
export type CaptureMode = 'screenshot' | 'video' | 'floating';

// ClickUp Hierarchy Types
export interface ClickUpTeam {
    id: string;
    name: string;
}
export interface ClickUpSpace {
    id: string;
    name: string;
}
export interface ClickUpFolder {
    id: string;
    name: string;
    lists: ClickUpList[];
}
export interface ClickUpList {
    id: string;
    name: string;
    access?: boolean;
}
export interface ClickUpHierarchyList {
    id: string;
    name: string;
    groupName: string; // "Space Name > Folder Name"
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
  }
}