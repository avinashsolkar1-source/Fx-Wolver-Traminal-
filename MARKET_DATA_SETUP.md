# FX WOLVER market-data provider setup

## Twelve Data Forex candles (optional, disabled by default)

The Worker has an optional Twelve Data fallback for supported FX pairs such as
`EURUSD=X`. It requests OHLC time series from `/time_series` and validates
timestamps and OHLC consistency before returning candles.

### Before enabling

1. Confirm with Twelve Data in writing that the selected account and any required
   exchange/vendor permissions allow the intended commercial display to FX WOLVER
   end users. API access alone must not be treated as redistribution permission.
2. Confirm the subscribed plan supports the required forex intervals and expected
   request volume for the actual user count.
3. Add the API key as a Cloudflare Worker secret named
   `TWELVE_DATA_API_KEY`. Never commit the key or put it in frontend code.
4. Only after the required rights are confirmed, set the Worker variable
   `TWELVE_DATA_ENABLED` to the literal string `true`.

Without both the secret and enable variable, the integration stays disabled.
No API key or market-data subscription is purchased by this repository.

### Supported intervals

- `1m` -> Twelve Data `1min`
- `5m` -> Twelve Data `5min`
- `15m` -> Twelve Data `15min`
- `1h` -> Twelve Data `1h`
- `4h` -> aggregated from Twelve Data `1h`
- `1d` -> Twelve Data `1day`

The fallback order for candles is Tiingo, Twelve Data (when explicitly enabled),
then Yahoo Finance. A provider response is returned only if the Worker quality
checks pass. If all providers fail validation, the API returns an error rather
than inventing or flattening candles.

### Verification

After enabling with valid credentials and rights, test a single pair and interval:

```text
/api/candles?s=EURUSD%3DX&i=1m
```

A successful Twelve Data response includes the
`x-market-data-provider: Twelve Data` header. Check that timestamps are current
and OHLC values are plausible before allowing trading features to use the feed.
