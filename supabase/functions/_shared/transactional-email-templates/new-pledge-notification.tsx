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

interface NewPledgeProps {
  pledgeId?: string
  pledgerName?: string
  pledgerEmail?: string
  amountUsd?: string
  feeUsd?: string
  totalUsd?: string
  tier?: string
  path?: string
  paymentMethod?: string
  lockMonths?: number
  solanaWallet?: string
  notes?: string
  creditsAwarded?: number
  submittedAt?: string
}

const NewPledgeEmail = (p: NewPledgeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New pledge from ${p.pledgerName || 'an investor'} — ${p.totalUsd || ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New investor pledge</Heading>
        <Text style={text}>
          <strong>{p.pledgerName || 'A new investor'}</strong> just submitted a pledge. Review and settle from the team portal.
        </Text>
        <Section style={card}>
          <Text style={row}><strong>Amount:</strong> {p.amountUsd || '—'} <span style={muted}>(+ fee {p.feeUsd || '—'} = {p.totalUsd || '—'})</span></Text>
          <Text style={row}><strong>Tier:</strong> {p.tier || '—'} · <strong>Path:</strong> {p.path || '—'}</Text>
          <Text style={row}><strong>Lock:</strong> {p.lockMonths ?? 0} months</Text>
          <Text style={row}><strong>Payment:</strong> {p.paymentMethod || '—'}</Text>
          <Text style={row}><strong>Solana wallet:</strong> {p.solanaWallet || '—'}</Text>
          <Text style={row}><strong>Contact:</strong> {p.pledgerEmail || '—'}</Text>
          <Text style={row}><strong>Submitted:</strong> {p.submittedAt || '—'}</Text>
          {p.notes ? <Text style={row}><strong>Notes:</strong> {p.notes}</Text> : null}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>Open Team Portal → Investor pledges to fulfill this pledge and issue credits.</Text>
        <Text style={footerId}>Ref: {p.pledgeId || '—'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewPledgeEmail,
  subject: (data: Record<string, any>) =>
    `New pledge — ${data?.totalUsd || 'investor'} (${data?.tier || 'tier'})`,
  displayName: 'New investor pledge — admin notification',
  previewData: {
    pledgeId: '00000000-0000-0000-0000-000000000000',
    pledgerName: 'Jordan Lee',
    pledgerEmail: 'jordan@example.com',
    amountUsd: '$1,000.00',
    feeUsd: '$70.00',
    totalUsd: '$1,070.00',
    tier: 'builder',
    path: 'assisted',
    paymentMethod: 'square',
    lockMonths: 3,
    solanaWallet: '—',
    notes: 'Excited to support.',
    creditsAwarded: 0,
    submittedAt: 'Wed, Jul 22, 2026 — 1:15 AM ET',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '580px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0a0a0a', margin: '0 0 16px', letterSpacing: '-0.01em' }
const text = { fontSize: '14px', color: '#3f3f46', lineHeight: '1.55', margin: '0 0 20px' }
const card = { border: '1px solid #e4e4e7', borderRadius: '8px', padding: '18px 20px', backgroundColor: '#fafafa', margin: '0 0 24px' }
const row = { fontSize: '14px', color: '#0a0a0a', margin: '0 0 8px', lineHeight: '1.5' }
const muted = { color: '#71717a' }
const hr = { borderColor: '#e4e4e7', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#71717a', margin: 0 }
const footerId = { fontSize: '11px', color: '#a1a1aa', margin: '6px 0 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
