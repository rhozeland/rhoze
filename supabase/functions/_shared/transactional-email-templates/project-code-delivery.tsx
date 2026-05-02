import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
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

interface ProjectCodeDeliveryProps {
  name?: string
  projectCode?: string
  portalUrl?: string
  kind?: 'subscription' | 'one_time'
}

const ProjectCodeDeliveryEmail = ({
  name,
  projectCode = 'RHZ-XXXX-XXXX',
  portalUrl = 'https://www.rhozeland.com/team.html#/client',
  kind = 'one_time',
}: ProjectCodeDeliveryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} project code: {projectCode}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Welcome, ${name}.` : 'Welcome to Rhozeland.'}
        </Heading>
        <Text style={text}>
          Thanks for {kind === 'subscription' ? 'subscribing' : 'your order'}. Your project is set up and
          ready in the client portal.
        </Text>

        <Section style={codeBox}>
          <Text style={codeLabel}>YOUR PROJECT CODE</Text>
          <Text style={codeValue}>{projectCode}</Text>
        </Section>

        <Text style={text}>
          Use this code the first time you sign in. It links your project to your account, so you can
          track milestones, see your estimate, and use your credits.
        </Text>

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={`${portalUrl}?code=${encodeURIComponent(projectCode)}`} style={button}>
            Open my portal
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Save this email — you'll only need the code once. After that, sign in with your email and
          password from the portal.
        </Text>
        <Text style={footer}>— The {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ProjectCodeDeliveryEmail,
  subject: (data: Record<string, any>) =>
    `Your Rhozeland project code: ${data?.projectCode ?? ''}`.trim(),
  displayName: 'Project code delivery',
  previewData: {
    name: 'Jordan',
    projectCode: 'RHZ-AB12-CD34',
    portalUrl: 'https://www.rhozeland.com/team.html#/client',
    kind: 'one_time',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#3f3f46', lineHeight: '1.55', margin: '0 0 16px' }
const codeBox = {
  border: '1px solid #e5e5e5',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '20px 0',
  textAlign: 'center' as const,
  backgroundColor: '#fafafa',
}
const codeLabel = {
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: '#71717a',
  margin: '0 0 4px',
}
const codeValue = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#0a0a0a',
  letterSpacing: '0.04em',
  margin: 0,
  fontFamily: 'monospace',
}
const button = {
  backgroundColor: '#0a0a0a',
  color: '#ffffff',
  padding: '12px 22px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  display: 'inline-block',
}
const hr = { borderColor: '#e5e5e5', margin: '28px 0 16px' }
const footer = { fontSize: '12px', color: '#71717a', margin: '0 0 8px' }