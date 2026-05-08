import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface TaskCompletedProps {
  taskTitle?: string
  assigneeName?: string
  quadrant?: string
  completedAt?: string
}

const TaskCompletedEmail = ({ taskTitle, assigneeName, quadrant, completedAt }: TaskCompletedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${assigneeName || 'Teammate'} completed: ${taskTitle || 'a task'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Task completed</Heading>
        <Text style={text}>
          {assigneeName || 'A teammate'} marked an assigned task as done.
        </Text>
        <Section style={card}>
          <Text style={row}><strong>Task:</strong> {taskTitle || '—'}</Text>
          <Text style={row}><strong>Assignee:</strong> {assigneeName || '—'}</Text>
          {quadrant ? <Text style={row}><strong>Quadrant:</strong> {quadrant}</Text> : null}
          {completedAt ? <Text style={row}><strong>Completed:</strong> {completedAt}</Text> : null}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>Open the dashboard to review your team's matrix.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TaskCompletedEmail,
  subject: (data: Record<string, any>) =>
    `Task completed — ${data?.taskTitle || 'assigned task'}${data?.assigneeName ? ` (${data.assigneeName})` : ''}`,
  displayName: 'Task completed — admin notification',
  previewData: {
    taskTitle: 'Review Time & Pay timesheet system',
    assigneeName: 'Jordan',
    quadrant: 'Do',
    completedAt: 'Fri, May 8, 2026 — 2:15 PM ET',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0a0a0a', margin: '0 0 16px', letterSpacing: '-0.01em' }
const text = { fontSize: '14px', color: '#3f3f46', lineHeight: '1.55', margin: '0 0 20px' }
const card = { border: '1px solid #e4e4e7', borderRadius: '8px', padding: '18px 20px', backgroundColor: '#fafafa', margin: '0 0 24px' }
const row = { fontSize: '14px', color: '#0a0a0a', margin: '0 0 8px', lineHeight: '1.5' }
const hr = { borderColor: '#e4e4e7', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#71717a', margin: 0 }