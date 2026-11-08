---
name: Purchase order number uniqueness
description: Why purchase-entry order numbers are random without a database unique constraint.
---

Purchase order numbers currently use 64 bits of randomness, and the database column is nullable for older records.

**Why:** Drizzle's push prompt to add a unique constraint asked whether to truncate existing purchase entries. The table must not be truncated just to add this constraint.

**How to apply:** If stronger uniqueness is needed, add a safe unique index that excludes null values rather than accepting a prompt that may remove existing entries.
