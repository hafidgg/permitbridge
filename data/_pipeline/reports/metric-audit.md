# Phase 2.1 Metric Audit — Field vs. Source Reconciliation

Generated: 2026-08-08T22:03:56.628Z

## Field-Level Reconciliation (unit: fields)

Total registered-nurse fields: 750

Fields with authoritative source: 125
Fields with secondary source: 80
Fields with no source: 545

125 + 80 + 545 = 750 ✅ matches total

> Note: the current schema allows exactly one `sourceUrl` per field, so 'total field-source relationships' and 'unique fields with a source of that type' are numerically identical to the counts above. Reported as separate named figures below on purpose, so a future multi-source-per-field schema change doesn't silently reuse this report's meaning.

Total field-source relationships: 205
Unique fields with at least one authoritative source: 125
Unique fields with at least one secondary source: 80
Unique fields with no source: 545

## Source-Level Reconciliation (unit: source records)

Official source records: 58
Secondary source records: 1
Total source records: 59

Official sources actually referenced by >=1 field: 17
Secondary sources actually referenced by >=1 field: 1
Unused source records (fieldsUsingThisSource = 0): 41

17 + 1 + 41 = 59 ✅ matches total source records

Unused source IDs: alabama-nursing-board, alaska-nursing-board, arizona-nursing-board, arkansas-nursing-board, colorado-nursing-board, connecticut-nursing-board, delaware-nursing-board, hawaii-nursing-board, idaho-nursing-board, indiana-nursing-board, iowa-nursing-board, kansas-nursing-board, kentucky-nursing-board, louisiana-nursing-board, maine-nursing-board, maryland-nursing-board, massachusetts-nursing-board, minnesota-nursing-board, mississippi-nursing-board, missouri-nursing-board, montana-nursing-board, nebraska-nursing-board, nevada-nursing-board, new-hampshire-nursing-board, new-jersey-nursing-board, new-mexico-nursing-board, new-york-fees-chart-general, north-dakota-nursing-board, oklahoma-nursing-board, oregon-nursing-board, rhode-island-nursing-board, south-carolina-nursing-board, south-dakota-nursing-board, tennessee-nursing-board, utah-nursing-board, vermont-nursing-board, virginia-nursing-board, washington-nursing-board, west-virginia-nursing-board, wisconsin-nursing-board, wyoming-nursing-board
Referenced source IDs: california-fee-schedule, california-nursing-board, florida-fee-schedule, florida-nursing-board, georgia-fee-schedule, georgia-nursing-board, illinois-fee-schedule, illinois-nursing-board, michigan-nursing-board, ncsbn-nclex, ncsbn-nurse-compact, new-york-fee-schedule, new-york-nursing-board, north-carolina-nursing-board, nurse-org-board-directory, ohio-nursing-board, pennsylvania-nursing-board, texas-nursing-board