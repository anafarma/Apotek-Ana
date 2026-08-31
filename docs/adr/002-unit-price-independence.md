# ADR-002 — Unit and Price Independence

Status: Accepted

Selling units and their prices are independent from inventory conversion.

Example:
- Strip: base unit, sale price Rp4,000
- Box: 10 Strip, sale price Rp35,000

The system must never infer Box price from Strip price. A SaleItem snapshots the selected unit, quantity, conversion factor and price at commit.