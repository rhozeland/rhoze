---
name: Credit definition
description: How 1 credit is anchored on the Start a Project page (time + output hybrid)
type: feature
---
1 credit = $75 (CREDIT_VALUE_CENTS = 7500), defined as **~2 hours of focused specialist work OR one small deliverable** (whichever the service maps to).

Hybrid time+output framing keeps the unit meaningful across disciplines (mixing sessions, social posts, design rounds, strategy calls). Service catalog remains the source of truth for exact per-service credit costs.

Anchor copy lives in `src/start/StartPage.tsx`:
- Intro footer line (~line 332)
- Build-step anchor card (~line 366)
- Sidebar order summary keeps compact `1 credit = $75` only.
