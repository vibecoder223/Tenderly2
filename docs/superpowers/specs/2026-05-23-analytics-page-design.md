# Analytics Page Design

**Date:** 2026-05-23  
**Status:** Approved

## Overview

Single scrollable analytics page with a time range filter at the top. All sections respond to the selected range. Audience: individual contributors (their workload) and managers (org-wide picture).

## Layout

```
[ Time range: 7d | 30d | 90d | All time ]

[ KPI Strip: 5 cards ]

[ Pipeline Status: stacked bar per deal ]

[ Bottlenecks: stuck in review | overdue deals ]

[ Team Table ]

[ AI Quality: 3 stat cards ]

[ Trends: 2 line charts ]
```

## Sections

### 1. KPI Strip
5 stat cards in a row:
- **Win rate** — won / (won + lost) in range
- **Avg completion time** — avg(first export created_at − deal created_at) in days
- **Questions approved %** — approved / total for deals in range
- **Active deals** — count of non-lost/won deals
- **Pipeline value** — sum of value for active deals

### 2. Pipeline Status
One row per active deal. Horizontal stacked bar: unanswered / drafting / in review / approved. Shows deal name + due date. Sortable by completion %.

### 3. Bottlenecks
Two side-by-side lists (always live, unaffected by time filter):
- Questions stuck in review >48h (question text + deal name + assigned to)
- Deals past due date with unapproved questions (deal name + open count)

### 4. Team Table
Columns: Member · Assigned · Completed · Completion % · Avg response time  
Avg response time = avg(response submitted_at − question created_at)  
Filtered by time range.

### 5. AI Quality
3 stat cards:
- **Avg confidence** — avg(responses.confidence) where not null
- **No-source rate** — count(gap_flag = no_source) / total responses
- **Regeneration rate** — count(agent_runs where agent_type = regeneration) / total responses

### 6. Trends
Two line charts, grouped by month:
- Win rate % by month
- Avg completion time (days) by month

## Data Sources

| Metric | Table | Key columns |
|---|---|---|
| Win/loss | deals | status, closed_at (use updated_at as proxy) |
| Completion time | deals + exports | deals.created_at, exports.created_at |
| Question status | questions | status, document_id → deal_id |
| Bottlenecks | questions | status, last_activity_at |
| Team | questions + responses | assigned_to, submitted_at, created_at |
| AI quality | responses | confidence, gap_flag |
| Regeneration | agent_runs | agent_type = 'regeneration' |
| Trends | deals + exports | grouped by month |

## Implementation Notes

- Time range as `?from=YYYY-MM-DD&to=YYYY-MM-DD` search params; server reads them
- Presets (7d/30d/90d/All) are client-side buttons that push search params
- Charts rendered client-side with recharts (already in use in project or add lightweight)
- Bottlenecks section ignores time filter — always live
- Completion time falls back to `—` if no export exists for a deal
- All queries scoped by `org_id` via existing RLS
