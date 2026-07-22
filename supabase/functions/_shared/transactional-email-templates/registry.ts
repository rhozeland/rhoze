/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as bookingNotification } from './discovery-call-notification.tsx'
import { template as projectCodeDelivery } from './project-code-delivery.tsx'
import { template as taskCompleted } from './task-completed.tsx'
import { template as newPledgeNotification } from './new-pledge-notification.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'discovery-call-notification': bookingNotification,
  'project-code-delivery': projectCodeDelivery,
  'task-completed': taskCompleted,
  'new-pledge-notification': newPledgeNotification,
}