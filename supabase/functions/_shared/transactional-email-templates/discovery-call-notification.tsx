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

const SITE_NAME = 'Rhozeland'

interface DiscoveryCallProps {
  name?: string
  email?: string
  phone?: string
  slotLabel?: string
  notes?: string
}

const DiscoveryCallNotificationEmail = ({
  name,
  email,
  phone,
  slotLabel,
  notes,
}: DiscoveryCallProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New 20-min discovery call booked{name ? ` — ${name}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New discovery call booked</Heading>
        <Text style={text}>
          Someone just booked a 20-minute discovery call through {SITE_NAME}.
        </Text>

        <Section style={card}>
          <Text style={row}><strong>When:</strong> {slotLabel || '—'}</Text>
          <Text style={row}><strong>Name:</strong> {name || '—'}</Text>
          <Text style={row}><strong>Email:</strong> {email || '—'}</Text>
          {phone ? <Text style={row}><strong>Phone:</strong> {phone}</Text> : null}
          {notes ? <Text style={row}><strong>Notes:</strong> {notes}</Text> : null}
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Add this to your Google Calendar manually so it shows up on your team's schedule.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DiscoveryCallNotificationEmail,
  subject: (data: Record<string, any>) =>
    `New discovery call — ${data?.slotLabel || 'new booking'}${data?.name ? ` (${data.name})` : ''}`,
  displayName: 'Discovery call — internal notification',
  previewData: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1 555 123 4567',
    slotLabel: 'Tue, May 5, 2026 — 10:20 AM ET',
    notes: 'Interested in the visual identity package.',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
}
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#0a0a0a',
  margin: '0 0 16px',
  letterSpacing: '-0.01em',
}
const text = {
  fontSize: '14px',
  color: '#3f3f46',
  lineHeight: '1.55',
  margin: '0 0 20px',
}
const card = {
  border: '1px solid #e4e4e7',
  borderRadius: '8px',
  padding: '18px 20px',
  backgroundColor: '#fafafa',
  margin: '0 0 24px',
}
const row = {
  fontSize: '14px',
  color: '#0a0a0a',
  margin: '0 0 8px',
  lineHeight: '1.5',
}
const hr = { borderColor: '#e4e4e7', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#71717a', margin: 0 }