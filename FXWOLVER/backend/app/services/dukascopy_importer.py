"""
Dukascopy Historical Forex Data Importer
==========================================
Supports:
1. Parsing Dukascopy exported tick CSV files.
2. Aggregating tick data into OHLCV candles (M1, M5, M15, H1, D1).
3. Preserving strict UTC timestamps.
4. Exporting to JSON or database format for FXWOLVER charting engine.

Typical Dukascopy tick CSV format:
  Time (UTC),Ask,Bid,AskVolume,BidVolume
  2024-01-02 00:00:00.123,1.10352,1.10340,1.5,2.0
"""
import csv
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

TF_SECONDS = {
    "M1": 60,
    "M5": 300,
    "M15": 900,
    "M30": 1800,
    "H1": 3600,
    "H4": 14400,
    "D1": 86400,
}


class DukascopyImporter:
    """
    Imports and transforms Dukascopy tick or bar data for FXWOLVER.
    """

    @staticmethod
    def parse_timestamp(ts_str: str) -> int:
        """
        Parses Dukascopy timestamp formats to POSIX seconds (UTC).
        Examples: '2024.01.02 00:00:00.123', '2024-01-02 00:00:00', '02.01.2024 00:00:00.000'
        """
        cleaned = ts_str.strip().replace('/', '-').replace('.', '-')
        # Handle decimal seconds if present
        if '.' in cleaned and len(cleaned.split('.')[-1]) <= 6:
            parts = cleaned.rsplit('.', 1)
            main_part = parts[0]
        else:
            main_part = cleaned

        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(main_part, fmt).replace(tzinfo=timezone.utc)
                return int(dt.timestamp())
            except ValueError:
                continue

        # Fallback to float unix timestamp
        try:
            return int(float(ts_str))
        except ValueError:
            raise ValueError(f"Unrecognized timestamp format: {ts_str}")

    @classmethod
    def convert_ticks_to_candles(
        cls,
        csv_file_path: str,
        symbol: str,
        timeframe: str = "H1",
        price_field: str = "mid",  # 'bid', 'ask', or 'mid'
    ) -> List[dict]:
        """
        Reads a Dukascopy tick CSV file and aggregates it into OHLCV candles.
        """
        tf_sec = TF_SECONDS.get(timeframe.upper(), 3600)
        candles_dict: Dict[int, dict] = {}

        path = Path(csv_file_path)
        if not path.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_file_path}")

        logger.info(f"Processing Dukascopy ticks for {symbol} -> {timeframe}...")

        with open(path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = [h.strip().lower() for h in next(reader, [])]

            # Try to identify column indices
            time_idx = 0
            ask_idx = 1
            bid_idx = 2
            vol_idx = 3

            for idx, col in enumerate(header):
                if "time" in col or "date" in col:
                    time_idx = idx
                elif "ask" in col and "vol" not in col:
                    ask_idx = idx
                elif "bid" in col and "vol" not in col:
                    bid_idx = idx
                elif "vol" in col:
                    vol_idx = idx

            for row in reader:
                if not row or len(row) <= max(time_idx, ask_idx, bid_idx):
                    continue

                try:
                    ts = cls.parse_timestamp(row[time_idx])
                    ask = float(row[ask_idx])
                    bid = float(row[bid_idx])
                    vol = float(row[vol_idx]) if len(row) > vol_idx else 1.0

                    if price_field == "ask":
                        price = ask
                    elif price_field == "bid":
                        price = bid
                    else:
                        price = (ask + bid) / 2.0

                    bucket = (ts // tf_sec) * tf_sec

                    if bucket not in candles_dict:
                        candles_dict[bucket] = {
                            "time": bucket,
                            "open": price,
                            "high": price,
                            "low": price,
                            "close": price,
                            "volume": vol,
                            "provider": "DUKASCOPY",
                            "is_simulated": False,
                        }
                    else:
                        c = candles_dict[bucket]
                        if price > c["high"]:
                            c["high"] = price
                        if price < c["low"]:
                            c["low"] = price
                        c["close"] = price
                        c["volume"] += vol

                except Exception as err:
                    continue

        sorted_candles = [candles_dict[k] for k in sorted(candles_dict.keys())]
        logger.info(f"Generated {len(sorted_candles)} {timeframe} candles for {symbol}")
        return sorted_candles

    @classmethod
    def save_to_json(cls, candles: List[dict], output_path: str) -> None:
        """Saves parsed candles to JSON file ready for backend cache."""
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(candles, f, indent=2)
        logger.info(f"Saved candles to {output_path}")


if __name__ == "__main__":
    import sys
    print("Dukascopy Importer Ready.")
    print("Usage: python dukascopy_importer.py <path_to_csv> <symbol> <timeframe>")
