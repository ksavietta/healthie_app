require "rails_helper"

RSpec.describe "Providers API", type: :request do
  # A method, not let: each request needs a fresh parse of its own response.
  def json = response.parsed_body

  describe "GET /providers" do
    it "returns 200 with id, name and email for each provider, ordered by id" do
      first = create(:provider)
      second = create(:provider)

      get "/providers"

      expect(response).to have_http_status(:ok)
      expect(json.map { |p| p["id"] }).to eq([first.id, second.id])
      expect(json.first.keys).to contain_exactly("id", "name", "email")
      expect(json.first).to include("name" => first.name, "email" => first.email)
    end

    it "returns an empty array when there are no providers" do
      get "/providers"

      expect(response).to have_http_status(:ok)
      expect(json).to eq([])
    end

    it "returns at most 50 providers by default" do
      create_list(:provider, 55)

      get "/providers"

      expect(json.size).to eq(50)
    end

    it "honours a smaller limit" do
      create_list(:provider, 5)

      get "/providers", params: { limit: 2 }

      expect(json.size).to eq(2)
    end

    it "caps the limit at 100" do
      create_list(:provider, 105)

      get "/providers", params: { limit: 500 }

      expect(json.size).to eq(100)
    end

    it "falls back to the default for a limit below 1" do
      create_list(:provider, 3)

      get "/providers", params: { limit: 0 }

      expect(json.size).to eq(3)
    end

    ["abc", "", "-5"].each do |bad|
      it "falls back to the default for limit=#{bad.inspect}" do
        create_list(:provider, 3)

        get "/providers", params: { limit: bad }

        expect(response).to have_http_status(:ok)
        expect(json.size).to eq(3)
      end
    end

    it "does not error on an array limit" do
      create_list(:provider, 3)

      get "/providers?limit[]=1"

      expect(response).to have_http_status(:ok)
      expect(json.size).to eq(3)
    end
  end

  describe "GET /providers/:id" do
    it "returns 200 with the provider's id, name and email" do
      provider = create(:provider)

      get "/providers/#{provider.id}"

      expect(response).to have_http_status(:ok)
      expect(json).to eq(
        "id" => provider.id, "name" => provider.name, "email" => provider.email
      )
    end

    it "returns 404 with an error message for a missing provider" do
      get "/providers/0"

      expect(response).to have_http_status(:not_found)
      expect(json).to eq("error" => "Provider not found")
    end

    it "returns 404 for a non-numeric id" do
      get "/providers/not-a-number"

      expect(response).to have_http_status(:not_found)
      expect(json).to include("error")
    end
  end

  describe "GET /providers/:id/clients" do
    it "returns 200 with each client's id, name, email and plan with this provider" do
      provider = create(:provider)
      client = create(:client)
      create(:enrollment, provider: provider, client: client, plan: "premium")

      get "/providers/#{provider.id}/clients"

      expect(response).to have_http_status(:ok)
      expect(json.size).to eq(1)
      expect(json.first.keys).to contain_exactly("id", "name", "email", "plan")
      expect(json.first).to eq(
        "id" => client.id, "name" => client.name, "email" => client.email, "plan" => "premium"
      )
    end

    it "reports the plan for this provider, not another provider's plan for the same client" do
      client = create(:client)
      dana = create(:provider)
      sam = create(:provider)
      create(:enrollment, provider: dana, client: client, plan: "premium")
      create(:enrollment, provider: sam, client: client, plan: "basic")

      get "/providers/#{sam.id}/clients"

      expect(json).to contain_exactly(
        a_hash_including("id" => client.id, "plan" => "basic")
      )
    end

    it "excludes clients enrolled only with other providers" do
      provider = create(:provider)
      create(:enrollment, provider: create(:provider), client: create(:client))

      get "/providers/#{provider.id}/clients"

      expect(json).to eq([])
    end

    it "returns 404 for a missing provider" do
      get "/providers/0/clients"

      expect(response).to have_http_status(:not_found)
      expect(json).to eq("error" => "Provider not found")
    end

    it "honours the limit parameter" do
      provider = create(:provider)
      create_list(:enrollment, 4, provider: provider)

      get "/providers/#{provider.id}/clients", params: { limit: 3 }

      expect(json.size).to eq(3)
    end
  end

  describe "GET /providers/:id/journal_entries" do
    it "returns 200 with id, client_id, body and written_at, newest first across clients" do
      provider = create(:provider)
      client_a = create(:client)
      client_b = create(:client)
      create(:enrollment, provider: provider, client: client_a)
      create(:enrollment, provider: provider, client: client_b)

      older = create(:journal_entry, client: client_a, body: "older", written_at: Time.zone.local(2026, 1, 1, 9))
      newer = create(:journal_entry, client: client_b, body: "newer", written_at: Time.zone.local(2026, 1, 2, 9))

      get "/providers/#{provider.id}/journal_entries"

      expect(response).to have_http_status(:ok)
      expect(json.map { |e| e["id"] }).to eq([newer.id, older.id])
      expect(json.first.keys).to contain_exactly("id", "client_id", "body", "written_at")
      expect(json.first).to include("client_id" => client_b.id, "body" => "newer")
      expect(Time.zone.parse(json.first["written_at"])).to eq(newer.written_at)
    end

    it "excludes entries from clients who belong to other providers" do
      provider = create(:provider)
      mine = create(:client)
      theirs = create(:client)
      create(:enrollment, provider: provider, client: mine)
      create(:enrollment, provider: create(:provider), client: theirs)
      my_entry = create(:journal_entry, client: mine)
      create(:journal_entry, client: theirs)

      get "/providers/#{provider.id}/journal_entries"

      expect(json.map { |e| e["id"] }).to eq([my_entry.id])
    end

    it "returns each entry once when a client has several providers" do
      provider = create(:provider)
      shared = create(:client)
      create(:enrollment, provider: provider, client: shared)
      create(:enrollment, provider: create(:provider), client: shared)
      entries = create_list(:journal_entry, 2, client: shared)

      get "/providers/#{provider.id}/journal_entries"

      expect(json.map { |e| e["id"] }).to match_array(entries.map(&:id))
    end

    it "returns an empty array for a provider with no clients" do
      get "/providers/#{create(:provider).id}/journal_entries"

      expect(response).to have_http_status(:ok)
      expect(json).to eq([])
    end

    it "returns 404 for a missing provider" do
      get "/providers/0/journal_entries"

      expect(response).to have_http_status(:not_found)
      expect(json).to eq("error" => "Provider not found")
    end

    it "returns at most 50 entries by default and caps the limit at 100" do
      provider = create(:provider)
      client = create(:client)
      create(:enrollment, provider: provider, client: client)
      create_list(:journal_entry, 105, client: client)

      get "/providers/#{provider.id}/journal_entries"
      expect(json.size).to eq(50)

      get "/providers/#{provider.id}/journal_entries", params: { limit: 1000 }
      expect(json.size).to eq(100)
    end
  end
end
