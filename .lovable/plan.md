# Rhozeland system architecture diagram

Create a standalone Mermaid UML-style component diagram covering the system as it exists today.

- Show visitor, creator, client, and team entry points: public pages, Community and Discover, booking and project creation, release pages, client portal, team workspace, and the $RHOZE market explorer.
- Show Lovable Cloud services: authentication and roles, the database with separate public talent and private account data, file storage, server functions, and their connections to the pages.
- Show external services only where used: Stripe checkout/webhooks, AI roadmap and copilot, Solana market/wallet lookups, Pump.fun coin links, and email delivery.
- Label the boundary between working data flows and preview-only capabilities. In particular, do not present the release page's funding bar, wallet connection, milestone receipt, or token unlock demo as real on-chain payments or escrow.
- Save the `.mmd` diagram as a downloadable file and include the Mermaid source in the response.

## Technical details

Use Mermaid `flowchart` syntax with subgraphs as UML component boundaries and labeled arrows for major interactions. Keep the graph readable rather than enumerating every table or function. Validate Mermaid syntax before delivery.
