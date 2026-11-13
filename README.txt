COLLECTION ENTERPRISES — TICKERMINT CONNECTION BUILD

WHAT IS INCLUDED
- A separate Marketplace screen that loads when the player enters the shop.
- A dedicated "Test live connection" button in Price Center. It makes a real test search through the server to TickerMint.
- A server-side TickerMint proxy. The browser never calls TickerMint directly, avoiding its browser CORS restriction.
- Optional server-side API key support using the TICKERMINT_API_KEY environment variable. Never put a key in index.html or share it in chat.
- One-hour server response cache to reduce repeat API lookups.
- Explicit handling for quota limits, authorization errors, plan restrictions, invalid JSON, timeouts/network errors, and unmatched products.
- The game only stores a price when TickerMint returns a valid market value. Missing prices remain unavailable and cannot be used for in-game buying or selling.
- Visible "Prices: TickerMint" source links on imported prices.

RUN LOCALLY
1. Install Node.js 18 or newer on a computer/server.
2. Extract this ZIP.
3. Open a terminal in the extracted folder.
4. Run: npm start
5. Open: http://localhost:3000
6. Open Price Center and click "Test live connection".

OPTIONAL API KEY (SERVER ONLY)
- No key is required for basic testing. Current TickerMint documentation lists 100 no-key lookups per day per IP.
- A free key can raise the quota for eligible personal/non-commercial projects. Check the current TickerMint terms and limits before using one.
- Configure a key as the server environment variable TICKERMINT_API_KEY. Do not put it in the HTML, JavaScript sent to visitors, or a public repository.
- Example on macOS/Linux: TICKERMINT_API_KEY="your-key" npm start
- Example in Windows PowerShell: $env:TICKERMINT_API_KEY="your-key"; npm start
- On a hosting provider, add TICKERMINT_API_KEY in that provider's private environment-variable settings.

IMPORTANT CONNECTION FACTS
- The test button checks the real upstream TickerMint API, not just whether the local server is running.
- A successful test proves the server can reach TickerMint at that moment. It does not guarantee TickerMint uptime, unlimited quota, or that every product has a price.
- The no-key quota is shared by the server's public IP. If many visitors use the same hosted server, the limit can be reached sooner.
- The API returns daily TCGplayer market snapshots, not live listings or guaranteed sale prices. A daily market value can lag or be inaccurate.
- Search and product details are used for the prices. A product with no usable market field stays unpriced.
- The Marketplace refreshes tracked prices when opened and when Refresh prices is clicked. A browser page cannot refresh while closed.
- Accessories such as sleeves and binders are not priced by this Pokémon feed and remain unavailable until a separate authorized source is added.

LICENSING / PUBLIC RELEASE
- TickerMint's free/no-key and free-key access is for personal, non-commercial use and requires visible source attribution/linking.
- TickerMint's current documentation says commercial use inside a product, website, or tool requires an eligible commercial plan (API Pro or above). Confirm current terms directly with TickerMint before public release.
- Do not mirror or resell the provider's raw catalog or price feed.

LIMITATIONS
- This ZIP contains a working server integration, but no software can guarantee an external API will always be available.
- In this build environment, the local Node server and page passed local checks, but outbound access to api.tickermint.cards failed with a network fetch error. Therefore the live upstream connection is NOT confirmed from this environment. Use the in-game Test live connection button on the actual deployed host to confirm it there.
- The game stores progress in the current browser/device. There are no player accounts or cloud save sync.
