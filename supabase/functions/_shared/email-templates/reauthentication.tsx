/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoSection}>
          <Text style={logoText}>ShopBanao</Text>
        </div>
        <Hr style={divider} />
        <Heading style={h1}>Verification code</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#f3f4f6', fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '40px 0' }
const container = { backgroundColor: '#ffffff', padding: '32px 28px', borderRadius: '8px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logoText = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', letterSpacing: '-0.5px', margin: '0' }
const divider = { borderColor: '#e5e7eb', margin: '16px 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#191f2e', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#6b7280', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = { fontFamily: "'Courier New', Courier, monospace", fontSize: '28px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 28px', letterSpacing: '4px', textAlign: 'center' as const, backgroundColor: '#f3f4f6', padding: '12px 16px', borderRadius: '8px' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '28px 0 0', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }
