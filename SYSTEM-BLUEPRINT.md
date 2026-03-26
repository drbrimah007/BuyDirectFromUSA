# BuyDirectFromUSA — System Blueprint

## What This Actually Is

BuyDirectFromUSA = AI-powered sourcing desk + CRM + deal engine

NOT a marketplace. NOT a catalog. NOT Alibaba.

It's a **sourcing operating system** where:
- Clients submit requests
- AI processes and matches
- You review and approve
- Deals close with concierge support

## Core Architecture

### 1. CLIENT PIPELINE (Control Center)

Dashboard tabs:
- New Requests
- In Progress
- Awaiting Supplier
- Quotes Ready
- Negotiation
- Closed Deals

Each request = a **deal card**

### 2. REQUEST ENGINE

Smart intake form:
- Product needed
- Country (global search, not limited dropdown)
- Quantity
- Packaging
- Urgency
- Budget range
- Private label? yes/no

### 3. AI SOURCING ENGINE

When a request comes in, AI should:
- Classify product
- Identify category
- Suggest suppliers
- Flag compliance issues
- Generate RFQ draft
- Suggest pricing range
- Highlight risks

Then admin:
- Reviews
- Adjusts
- Sends

### 4. SUPPLIER MATCHING

System stores suppliers with:
- Categories
- Export readiness
- Countries served

Auto-match on request intake.

### 5. CLIENT INTERACTION

Each request = thread:
- Messages
- Files
- Quotes
- Notes
- Status

### 6. RESPONSE CONTROL

AI generates:
- Draft reply
- Supplier list
- Pricing suggestion
- Next step

Admin sees:
- Approve
- Edit
- Reject

Then send to client.

### 7. OPERATING MODES

- **Auto-mode**: AI responds immediately (with your style)
- **Manual mode**: AI drafts, you approve

### 8. INTERNAL NOTES

Each deal has:
- Private notes
- AI notes
- Supplier notes
- Risk flags

## Database Schema (Supabase)

### Tables needed:
- users (admin + clients + suppliers)
- deals (the core pipeline)
- deal_messages
- deal_files
- suppliers
- supplier_products
- rfq_drafts
- ai_suggestions
- countries (reference)
- compliance_rules
- notifications
- audit_log

### Deal states:
```
new → reviewing → matched → quoted → negotiating → closed_won → fulfilled
                                                  → closed_lost
```

## UI Structure

### Dashboard (main screen)
- Left: request/deal list
- Center: selected deal detail
- Right: AI assistant + suggestions

### Deal View tabs:
- Overview
- Messages
- Suppliers
- Quotes
- Documents
- Notes

### AI Panel shows:
- Suggested suppliers
- Draft response
- Compliance flags
- Next actions

## Business Model

Revenue from:
- Sourcing fees
- Supplier access subscriptions
- Deal commissions
- Premium concierge
- High-value product sourcing
