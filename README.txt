COLLECTION ENTERPRISES - BOOSTER PACK UPDATE

This update changes index.html only. Your existing Netlify function and Netlify settings do not need to be replaced.

New features:
- Booster Packs page for Base Set, Jungle, Fossil, Base Set 2, and Team Rocket.
- Card lists load from the public TCGdex card database.
- Opening a pack gives five cards from that set.
- Pulled cards become unlocked singles.
- Locked singles cannot be bought.
- Once unlocked, singles can be bought repeatedly when a verified price is available.
- You can sell only copies you own, and only when a verified price is available.
- Pack/card inventory and unlocked-card progress are saved in the browser.

IMPORTANT:
- Replace the existing root-level index.html in GitHub with this index.html.
- Do not delete or replace netlify/functions/tickermint.js or netlify.toml.
- Pack and single purchases still require a verified TickerMint price. The update does not invent prices.
- The five-card pack opening is a game mechanic, not a claim about the exact contents of historical physical booster packs.
