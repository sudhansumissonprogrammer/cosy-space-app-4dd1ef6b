import type { TemplateEntry } from './registry.ts'

export interface OrderConfirmationProps {
  orderNumber?: string
  customerName?: string
  items?: Array<{ name: string; quantity: number; price: string }>
  total?: string
  orderUrl?: string
  storeName?: string
}
