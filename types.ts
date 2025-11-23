
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
  clickUpListId?: string; // Added List ID
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
}

export type ClickUpExportMode = 'current' | 'all_attachments' | 'all_subtasks';
export type SlackExportMode = 'current' | 'all_files' | 'thread';

// New Video Recording Types
export type CaptureMode = 'screenshot' | 'video' | 'floating';

declare global {
  interface Window {
    documentPictureInPicture: {
      requestWindow(options: { width: number; height: number }): Promise<Window>;
      window: Window | null;
      onenter: ((ev: Event) => any) | null;
    };
  }
}