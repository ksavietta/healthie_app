# Run with: bin/rails runner script/demo_queries.rb
def print_query(title, relation)
  puts "\n=== #{title} ==="
  puts "SQL: #{relation.to_sql}"
  relation.each { |row| puts "  - #{yield(row)}" }
end

provider = Provider.find_by!(email: "dana@example.com")
client   = Client.find_by!(email: "alice@example.com")

print_query("1. Clients for #{provider.name}", provider.clients.order(:id)) { |c| "#{c.name} <#{c.email}>" }

print_query("2. Providers for #{client.name}", client.providers.order(:id)) { |p| "#{p.name} <#{p.email}>" }

print_query("3. Journal entries for #{client.name} (newest first)", client.journal_entries.recent_first) do |j|
  "#{j.written_at.iso8601}  #{j.body}"
end

print_query("4. Journal entries across #{provider.name}'s clients (newest first)", provider.journal_entries) do |j|
  "#{j.written_at.iso8601}  client=#{j.client_id}  #{j.body}"
end

puts "\nPlans with #{provider.name}:"
provider.enrollments.includes(:client).order(:id).each { |e| puts "  - #{e.client.name}: #{e.plan}" }
