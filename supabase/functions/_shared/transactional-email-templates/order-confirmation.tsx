/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

export interface OrderConfirmationProps {
  orderNumber?: string
  customerName?: string
  items?: Array<{ name: string; quantity: number; price: string }>
  total?: string
  orderUrl?: string
  storeName?: string
}

const OrderConfirmationEmail = ({
  orderNumber = '#SB-1234',
  customerName = 'there',
  items = [{ name: 'Sample Product', quantity: 1, price: '₹1,500' }],
  total = '₹1,500',
  orderUrl = '#',
  storeName = 'ShopBanao',
}: OrderConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your order {orderNumber} is confirmed — {storeName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoSection}>
          <Text style={logoText}>{storeName}</Text>
        </div>
        <Hr style={divider} />
        <Heading style={h1}>Order confirmed 🎉</Heading>
        <Text style={text}>Hi {customerName},</Text>
        <Text style={text}>
          Thank you for shopping with us. Your order <strong>{orderNumber}</strong> has been
          received and is being processed.
        </Text>

        <Section style={itemsSection}>
          <Text style={itemsHeader}>Order summary</Text>
          {items.map((item, index) => (
            <Row key={index} style={itemRow}>
              <Text style={itemName}>
                {item.name} × {item.quantity}
              </Text>
              <Text style={itemPrice}>{item.price}</Text>
            </Row>
          ))}
          <Hr style={divider} />
          <Row style={itemRow}>
            <Text style={itemName}>Total</Text>
            <Text style={itemPrice}>{total}</Text>
          </Row>
        </Section>

        <Button style={button} href={orderUrl}>
          View order details
        </Button>

        <Text style={footer}>
          Need help? Reply to this email or contact us at{' '}
          <Link href={`mailto:support@${storeName.toLowerCase().replace(/\s+/g, '')}.in`} style={link}>
            support
          </Link>
          .
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: (data: OrderConfirmationProps) =>
    `Order confirmed: ${data.orderNumber || '#SB-1234'}`,
  displayName: 'Order confirmation',
  previewData: {
    orderNumber: '#SB-1234',
    customerName: 'Jane',
    items: [
      { name: 'Gold-plated ring', quantity: 1, price: '₹1,500' },
      { name: 'Silver chain', quantity: 2, price: '₹2,400' },
    ],
    total: '₹3,900',
    orderUrl: 'https://shopbanao.in/order/1234',
    storeName: 'ShopBanao',
  },
} satisfies TemplateEntry
