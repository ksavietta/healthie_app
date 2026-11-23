require "rails_helper"

RSpec.describe "Clients API", type: :request do
  # A method, not let: each request needs a fresh parse of its own response.
  def json = response.parsed_body

  describe "GET /clients" do
    it "returns 200 with id, name and email for each client, ordered by id" do
      first = create(:client)
      second = create(:client)

      get "/clients"

      expect(response).to have_http_status(:ok)
      expect(json.map { |c| c["id"] }).to eq([first.id, second.id])
      expect(json.first.keys).to contain_exactly("id", "name", "email")
    end

    it "returns at most 50 clients by default" do
      create_list(:client, 55)

      get "/clients"

      expect(json.size).to eq(50)
    end

    it "honours a smaller limit" do
      create_list(:client, 5)

      get "/clients", params: { limit: 3 }

      expect(json.size).to eq(3)
    end

    it "caps the limit at 100" do
      create_list(:client, 105)

      get "/clients", params: { limit: 500 }

      expect(json.size).to eq(100)
    end
  end

  describe "GET /clients/:id" do
    it "returns 200 with the client's id, name and email" do
      client = create(:client)

      get "/clients/#{client.id}"

      expect(response).to have_http_status(:ok)
      expect(json).to eq("id" => client.id, "name" => client.name, "email" => client.email)
    end

    it "returns 404 with an error message for a missing client" do
      get "/clients/0"

      expect(response).to have_http_status(:not_found)
      expect(json).to eq("error" => "Client not found")
    end
  end

  describe "GET /clients/:id/providers" do
    it "returns 200 with each provider's id, name, email and this client's plan" do
      client = create(:client)
      provider = create(:provider)
      create(:enrollment, provider: provider, client: client, plan: "basic")

      get "/clients/#{client.id}/providers"

      expect(response).to have_http_status(:ok)
      expect(json.size).to eq(1)
      expect(json.first.keys).to contain_exactly("id", "name", "email", "plan")
      expect(json.first).to eq(
        "id" => provider.id, "name" => provider.name, "email" => provider.email, "plan" => "basic"
      )
    end

    it "returns each provider with its own plan when the client has several" do
      client = create(:client)
      dana = create(:provider)
      sam = create(:provider)
      create(:enrollment, provider: dana, client: client, plan: "premium")
      create(:enrollment, provider: sam, client: client, plan: "basic")
      create(:enrollment, provider: create(:provider), client: create(:client))

      get "/clients/#{client.id}/providers"

      expect(json).to contain_exactly(
        a_hash_including("id" => dana.id, "plan" => "premium"),
        a_hash_including("id" => sam.id, "plan" => "basic")
      )
    end

    it "returns an empty array for a client with no providers" do
      get "/clients/#{create(:client).id}/providers"

      expect(response).to have_http_status(:ok)
      expect(json).to eq([])
    end

    it "returns 404 for a missing client" do
      get "/clients/0/providers"

      expect(response).to have_http_status(:not_found)
      expect(json).to eq("error" => "Client not found")
    end

    it "honours the limit parameter" do
      client = create(:client)
      create_list(:enrollment, 3, client: client)

      get "/clients/#{client.id}/providers", params: { limit: 2 }

      expect(json.size).to eq(2)
    end
  end
end
