require "rails_helper"

RSpec.describe "Client journal entries API", type: :request do
  # A method, not let: each request needs a fresh parse of its own response.
  def json = response.parsed_body

  let(:client) { create(:client) }

  describe "GET /clients/:client_id/journal_entries" do
    it "returns 200 with id, client_id, body and written_at" do
      # Whole-second time: the JSON has millisecond precision, the database keeps microseconds.
      entry = create(:journal_entry, client: client, body: "Walked 40 minutes",
                                     written_at: Time.zone.local(2026, 1, 6, 9, 30))

      get "/clients/#{client.id}/journal_entries"

      expect(response).to have_http_status(:ok)
      expect(json.size).to eq(1)
      expect(json.first.keys).to contain_exactly("id", "client_id", "body", "written_at")
      expect(json.first).to include("id" => entry.id, "client_id" => client.id, "body" => "Walked 40 minutes")
      expect(Time.zone.parse(json.first["written_at"])).to eq(entry.written_at)
    end

    it "orders entries newest first by written_at, not by creation order" do
      oldest = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 1, 9))
      newest = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 5, 9))
      middle = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 3, 9))

      get "/clients/#{client.id}/journal_entries"

      expect(json.map { |e| e["id"] }).to eq([newest.id, middle.id, oldest.id])
    end

    it "breaks ties on equal written_at by newest id first" do
      same_time = Time.zone.local(2026, 1, 2, 7)
      first = create(:journal_entry, client: client, written_at: same_time)
      second = create(:journal_entry, client: client, written_at: same_time)

      get "/clients/#{client.id}/journal_entries"

      expect(json.map { |e| e["id"] }).to eq([second.id, first.id])
    end

    it "excludes entries belonging to other clients" do
      mine = create(:journal_entry, client: client)
      create(:journal_entry, client: create(:client))

      get "/clients/#{client.id}/journal_entries"

      expect(json.map { |e| e["id"] }).to eq([mine.id])
    end

    it "returns an empty array when the client has no entries" do
      get "/clients/#{client.id}/journal_entries"

      expect(response).to have_http_status(:ok)
      expect(json).to eq([])
    end

    it "returns 404 for a missing client" do
      get "/clients/0/journal_entries"

      expect(response).to have_http_status(:not_found)
      expect(json).to eq("error" => "Client not found")
    end

    it "returns at most 50 entries by default and caps the limit at 100" do
      create_list(:journal_entry, 105, client: client)

      get "/clients/#{client.id}/journal_entries"
      expect(json.size).to eq(50)

      get "/clients/#{client.id}/journal_entries", params: { limit: 1000 }
      expect(json.size).to eq(100)
    end

    it "returns the newest entries when limited" do
      oldest = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 1))
      newest = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 9))
      create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 5))

      get "/clients/#{client.id}/journal_entries", params: { limit: 1 }

      expect(json.map { |e| e["id"] }).to eq([newest.id])
      expect(json.map { |e| e["id"] }).not_to include(oldest.id)
    end
  end

  describe "POST /clients/:client_id/journal_entries" do
    it "returns 201 with the saved entry when written_at is given" do
      expect {
        post "/clients/#{client.id}/journal_entries",
             params: { body: "Had a big salad for lunch", written_at: "2026-01-10T12:00:00Z" },
             as: :json
      }.to change(JournalEntry, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(json.keys).to contain_exactly("id", "client_id", "body", "written_at")
      expect(json).to include("client_id" => client.id, "body" => "Had a big salad for lunch")
      expect(Time.zone.parse(json["written_at"])).to eq(Time.utc(2026, 1, 10, 12))

      stored = JournalEntry.find(json["id"])
      expect(stored.client).to eq(client)
      expect(stored.written_at).to eq(Time.utc(2026, 1, 10, 12))
    end

    it "defaults written_at to the current time when it is omitted" do
      travel_to(Time.zone.local(2026, 3, 4, 8, 30, 0)) do
        post "/clients/#{client.id}/journal_entries", params: { body: "No time given" }, as: :json
      end

      expect(response).to have_http_status(:created)
      expect(Time.zone.parse(json["written_at"])).to eq(Time.zone.local(2026, 3, 4, 8, 30, 0))
    end

    it "returns 422 with errors.body when the body is blank" do
      expect {
        post "/clients/#{client.id}/journal_entries", params: { body: "" }, as: :json
      }.not_to change(JournalEntry, :count)

      expect(response).to have_http_status(422)
      expect(json["errors"]).to have_key("body")
      expect(json["errors"]["body"]).to be_present
    end

    it "returns 422 when the body is missing entirely" do
      expect {
        post "/clients/#{client.id}/journal_entries", params: { written_at: "2026-01-10T12:00:00Z" }, as: :json
      }.not_to change(JournalEntry, :count)

      expect(response).to have_http_status(422)
      expect(json["errors"]).to have_key("body")
    end

    it "returns 422 when written_at is not a valid time" do
      expect {
        post "/clients/#{client.id}/journal_entries",
             params: { body: "Bad date", written_at: "not a date" },
             as: :json
      }.not_to change(JournalEntry, :count)

      expect(response).to have_http_status(422)
      expect(json["errors"]).to have_key("written_at")
    end

    it "returns 404 and creates nothing for a missing client" do
      expect {
        post "/clients/0/journal_entries", params: { body: "Orphan" }, as: :json
      }.not_to change(JournalEntry, :count)

      expect(response).to have_http_status(:not_found)
      expect(json).to eq("error" => "Client not found")
    end

    it "makes the new entry appear first in the client's list" do
      create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 1))

      post "/clients/#{client.id}/journal_entries",
           params: { body: "Latest", written_at: "2026-02-01T08:00:00Z" },
           as: :json
      new_id = json["id"]

      get "/clients/#{client.id}/journal_entries"

      expect(json.first["id"]).to eq(new_id)
    end
  end
end
