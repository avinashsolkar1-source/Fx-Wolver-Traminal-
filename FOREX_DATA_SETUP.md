# FXWOLVER Forex data setup

The Worker now supports Tiingo's Forex top-of-book and historical OHLC endpoints as the preferred FX source. This integration is optional until a valid API token is configured.

## Enable the licensed FX feed

1. Create/sign in to a Tiingo account and confirm that your account plan includes access to the Tiingo Forex API.
2. Generate a Tiingo API token in your Tiingo account.
3. In Cloudflare, open Workers & Pages -> fx-wolver-traminal -> Settings -> Variables and Secrets.
4. Add a secret named `TIINGO_API_TOKEN` and paste the token into Cloudflare's secret field. Do not put the token in GitHub, frontend JavaScript, or a public config file.
5. Deploy the latest GitHub build (or run `npx wrangler deploy` from the project root).

## What changes when configured

- Forex quote requests for symbols in Yahoo format (for example `EURUSD=X`) try Tiingo top-of-book first.
- When Tiingo returns valid bid and ask values, the Worker returns them with the midpoint and source timestamp.
- Forex historical candles try Tiingo OHLC data first. Supported native intervals are 1m, 5m, 15m, 30m, 1h and 1d; 4h is aggregated from hourly bars.
- If Tiingo is not configured or unavailable, the current legacy Yahoo/Stooq fallback remains. That fallback must not be described as guaranteed real-time or executable pricing.

## Important data notes

- Spot FX is an OTC market; prices can differ between liquidity providers and brokers.
- Tiingo FX data is market data, not an order-execution venue. Confirm plan permissions, latency and redistribution/display rights for your intended use.
- FX volume is not a centralized exchange-traded volume measure. Do not interpret a missing volume field as zero actual market volume.
- Check the provider and timestamp returned by the API before treating a quote as fresh.
