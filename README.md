# Healthie pairing interview prep

Two independent projects. Each folder has its own README with full setup, design notes, and known gaps.

| Folder | What it is | Stack |
| --- | --- | --- |
| [rails-health-journal](rails-health-journal/README.md) | Providers, clients, per-provider plans, and journal entries, with the four required queries and JSON endpoints | Ruby 3.4.12, Rails 8.1 (API-only), PostgreSQL, RSpec |
| [react-kanban-board](react-kanban-board/README.md) | Frontend-only Kanban board (To Do / Doing / Done) with Rick and Morty characters, drag and drop, and confetti | React, TypeScript, Vite, dnd-kit, Vitest |

## Quick start

Rails (needs a running Postgres):

```sh
cd rails-health-journal
bundle install
bin/rails db:create db:migrate db:seed
bin/rails runner script/demo_queries.rb   # prints the four queries and their SQL
bin/rails server                          # http://localhost:3000
bundle exec rspec
```

React:

```sh
cd react-kanban-board
npm install
npm run dev        # http://localhost:5173
npm run test:run
```
