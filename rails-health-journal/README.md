# Health Journal API

Small Rails 8 API (PostgreSQL) for providers (e.g. dietitians), their clients, and clients' journal entries.

## Prerequisites

- Ruby 3.4.12 (via rbenv; see `.ruby-version`)
- PostgreSQL running locally (default socket, no password needed in dev/test)

## Setup

```sh
rbenv install 3.4.12   # skip if already installed
bundle install
bin/rails db:create db:migrate db:seed
```

In development, `db:create` also creates the test database. If you need to sync its schema later, run `bin/rails db:test:prepare` before `bundle exec rspec`.

Seeds are idempotent, so re-running them is safe.

## Run the server

```sh
bin/rails server   # http://localhost:3000
```

## Endpoints (curl examples)

```sh
curl localhost:3000/providers
curl localhost:3000/providers/1
curl localhost:3000/providers/1/clients            # query 1, each with its plan
curl localhost:3000/providers/1/journal_entries    # query 4, newest first

curl localhost:3000/clients
curl localhost:3000/clients/1
curl localhost:3000/clients/1/providers            # query 2, each with its plan
curl localhost:3000/clients/1/journal_entries      # query 3, newest first

curl -X POST localhost:3000/clients/1/journal_entries \
  -H 'Content-Type: application/json' \
  -d '{"body": "Had a big salad for lunch", "written_at": "2026-01-10T12:00:00Z"}'
# 201 with the entry, or 422 {"errors": {...}}. Omit written_at to default to now; an explicit null is rejected (422).
```

Missing records return `404 {"error": "... not found"}`.
List endpoints accept `?limit=N` (default 50, max 100).

## The four queries

| # | Query | Code |
|---|-------|------|
| 1 | Clients for a provider | `provider.clients` |
| 2 | Providers for a client | `client.providers` |
| 3 | A client's entries, sorted | `client.journal_entries.recent_first` |
| 4 | Entries across a provider's clients, sorted | `JournalEntry.for_provider(provider)` (also `provider.journal_entries`) |

See them run, with generated SQL:

```sh
bin/rails runner script/demo_queries.rb
```

## Tests

```sh
bundle exec rspec
```

## Schema

```
providers        id, name, email (unique), timestamps
clients          id, name, email (unique), timestamps
enrollments      id, provider_id (FK), client_id (FK), plan, timestamps
                 unique index [provider_id, client_id]; index [client_id]; check plan IN ('basic','premium')
journal_entries  id, client_id (FK), body text, written_at, timestamps
                 index [client_id, written_at, id]
```

## Design choices

- **Join model (`Enrollment`) instead of HABTM.** The relationship carries data (`plan`), so it needs its own table and model. `has_many :through` gives us `provider.clients` and `client.providers` for free.
- **One plan per provider/client pair.** Unique index on `[provider_id, client_id]` plus a uniqueness validation. The index is the real guarantee (the validation alone has a race); the validation gives a friendly error.
- **`plan` is a string enum with a check constraint.** Readable in the database and in logs, and the DB rejects bad values even if someone bypasses Rails. Cost: adding a plan needs a migration to change the constraint. A Postgres native enum or a `plans` table are the alternatives; a table is better if plans gain attributes (price, etc.).
- **Email.** Required, normalized (strip + downcase via `normalizes`), basic format check, unique index. Because it is normalized before saving, a plain unique index is case-insensitive in practice.
- **`written_at` is explicit** and separate from `created_at`, so entries can be backdated. It defaults to the current time in the model if omitted.
- **Sort order: newest first** (`written_at DESC, id DESC`). `id` is the tiebreaker so the order is deterministic and pagination is stable.
- **Query 4 uses a subquery** (`client_id IN (SELECT client_id FROM enrollments WHERE provider_id = ?)`), not a join. A join would duplicate rows if the pair ever appeared twice, and the subquery keeps the result a plain `JournalEntry` relation that is easy to chain.
- **Indexes.** `enrollments` has the unique `[provider_id, client_id]` index (serves provider -> clients; its leading column makes a separate `provider_id` index redundant) and an index on `client_id` (serves client -> providers). `journal_entries` has `[client_id, written_at, id]` for query 3, matching the sort order including the tiebreaker.
- **Controllers** are thin and use `render json:` with `as_json(only: ...)`. No serializer gem.

## Known gaps and next steps

- **No authentication or authorization.** Anyone can read any client's journal or post to it. A real app needs auth, and providers should only see their own clients' entries.
- **Pagination** is just a capped `limit`. There is no offset or cursor.
- **Large datasets (query 4 is the hot spot):**
  - Use keyset (cursor) pagination on `(written_at, id)` instead of `OFFSET`, which gets slower the deeper you page.
  - Query 4 sorts across many clients, so `[client_id, written_at, id]` alone can't give an ordered scan. Options: an index on `(written_at DESC, id DESC)` with the planner filtering by client (good for providers with many clients), or fan-out per client and merge. Check with `EXPLAIN ANALYZE` on realistic data.
  - Add a `since`/date-range filter so queries are bounded.
  - Consider a denormalized `provider_id` on entries or a materialized feed if a provider's feed becomes a hot path. This adds write complexity.
  - Very large tables could be partitioned by `written_at`.
- Entry bodies are unbounded text; consider a length validation.
