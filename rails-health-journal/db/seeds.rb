# Idempotent: safe to run repeatedly.
providers = [
  ["Dana Dietitian", "dana@example.com"],
  ["Sam Nutrition", "sam@example.com"],
  ["Riley Coach", "riley@example.com"]
].to_h { |name, email| [email, Provider.find_or_create_by!(email: email) { |p| p.name = name }] }

clients = [
  ["Alice Adams", "alice@example.com"],
  ["Bob Brown", "bob@example.com"],
  ["Cara Chen", "cara@example.com"],
  ["Dev Patel", "dev@example.com"]
].to_h { |name, email| [email, Client.find_or_create_by!(email: email) { |c| c.name = name }] }

# [provider, client, plan]; Alice has two providers, Cara has two, Dev has none.
[
  ["dana@example.com", "alice@example.com", "premium"],
  ["sam@example.com",  "alice@example.com", "basic"],
  ["dana@example.com", "bob@example.com",   "basic"],
  ["sam@example.com",  "cara@example.com",  "premium"],
  ["riley@example.com", "cara@example.com", "basic"]
].each do |p_email, c_email, plan|
  Enrollment.find_or_create_by!(provider: providers[p_email], client: clients[c_email]) { |e| e.plan = plan }
end

base = Time.utc(2026, 1, 1, 12)
[
  ["alice@example.com", 0,  "Breakfast: oats and berries. Felt energetic."],
  ["alice@example.com", 2,  "Skipped lunch, snacked on crackers. Low energy by 3pm."],
  ["alice@example.com", 5,  "Walked 40 minutes. Dinner was salmon and rice."],
  ["bob@example.com",   1,  "Trying to cut sugar. Had tea without honey."],
  ["bob@example.com",   3,  "Late-night pizza. Feeling guilty."],
  ["cara@example.com",  4,  "Meal prepped chicken and veggies for the week."],
  ["cara@example.com",  4,  "Evening note: slept poorly, afternoon coffee probably didn't help."],
  ["dev@example.com",   6,  "Just signed up. No provider yet, tracking on my own."]
].each do |email, day_offset, body|
  clients[email].journal_entries.find_or_create_by!(body: body) { |j| j.written_at = base + day_offset.days }
end

puts "Seeded #{Provider.count} providers, #{Client.count} clients, " \
     "#{Enrollment.count} enrollments, #{JournalEntry.count} journal entries."
