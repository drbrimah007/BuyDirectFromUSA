# BuyDirectFromUSA — Full Build Specification

## What This Is

AI-powered sourcing desk + CRM + deal engine.
NOT a marketplace. NOT a catalog.

## User Types

1. **Admin/Owner** — full access, manage system, approve AI outputs
2. **Sourcing Manager** — manage requests, review AI, send responses
3. **Client/Buyer** — submit requests, view history, receive quotes
4. **Supplier** — receive RFQs, respond with pricing, upload docs

## Core Modules

1. Front page (keep current style)
2. Client request intake (smart dynamic form)
3. CRM / deal pipeline
4. Supplier database + matching
5. AI sourcing assistant
6. Messaging / response management
7. Quotes / RFQs
8. Documents / attachments
9. Country / market intelligence
10. Admin panel

## Deal Pipeline States

```
new → ai_reviewed → in_progress → awaiting_supplier → quote_ready →
awaiting_client → negotiating → closed_won → fulfilled
                              → closed_lost
→ archived
```

## AI Workflow

1. Client submits request
2. AI classifies, summarizes, suggests suppliers, flags compliance
3. Operator reviews: Approve / Edit / Reject
4. Operator sends to client or supplier
5. System tracks deal to close

## Database Tables

- users, user_profiles, companies
- clients, suppliers, supplier_contacts
- categories, countries, market_regions
- sourcing_requests, deals, deal_status_history
- deal_assignments, deal_messages, deal_notes
- documents, rfqs, rfq_items
- supplier_responses, quote_summaries
- ai_runs, ai_recommendations
- response_templates, notifications

## MVP Build Order

Phase 1: Auth, roles, front page, request intake, schema, dashboard shell
Phase 2: Deal pipeline, client records, messages, AI summary + drafts
Phase 3: Supplier database, matching, RFQ workflow, quote comparison
Phase 4: Documents, country intelligence, notifications, analytics
Phase 5: Client portal, supplier portal, admin enhancements

## Stack

Next.js + Tailwind + Supabase (Postgres + Auth + Storage + RLS)
