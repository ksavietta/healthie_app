require "rails_helper"

RSpec.describe Client, type: :model do
  describe "associations" do
    it "destroys its enrollments and journal entries when destroyed" do
      client = create(:client)
      enrollment = create(:enrollment, client: client)
      entry = create(:journal_entry, client: client)

      client.destroy!

      expect(Enrollment.exists?(enrollment.id)).to be(false)
      expect(JournalEntry.exists?(entry.id)).to be(false)
    end
  end

  describe "validations" do
    it "is valid with a name and email" do
      expect(build(:client)).to be_valid
    end

    it "requires a name" do
      client = build(:client, name: nil)

      expect(client).not_to be_valid
      expect(client.errors.added?(:name, :blank)).to be(true)
    end

    it "requires an email" do
      client = build(:client, email: nil)

      expect(client).not_to be_valid
      expect(client.errors.added?(:email, :blank)).to be(true)
    end

    it "rejects malformed email addresses" do
      ["plainaddress", "user@", "@example.com", "two words@example.com"].each do |bad|
        client = build(:client, email: bad)

        expect(client).not_to be_valid, "expected #{bad.inspect} to be invalid"
        expect(client.errors.of_kind?(:email, :invalid)).to be(true)
      end
    end

    it "strips whitespace and downcases the email before validation" do
      client = build(:client, email: "  Alice.Adams@Example.COM ")

      expect(client.email).to eq("alice.adams@example.com")
      expect(client).to be_valid
    end

    it "rejects a duplicate email regardless of case" do
      create(:client, email: "alice@example.com")
      duplicate = build(:client, email: "Alice@Example.com")

      expect(duplicate).not_to be_valid
      expect(duplicate.errors.of_kind?(:email, :taken)).to be(true)
    end
  end

  describe "database constraints" do
    it "rejects an exact duplicate email with the unique index, bypassing validations" do
      create(:client, email: "alice@example.com")

      expect {
        ActiveRecord::Base.transaction(requires_new: true) do
          Client.insert_all!([{ name: "Dup", email: "alice@example.com" }])
        end
      }.to raise_error(ActiveRecord::RecordNotUnique)
    end
  end

  describe "#providers" do
    it "returns every provider the client is enrolled with, and no others" do
      client = create(:client)
      dana = create(:provider)
      sam = create(:provider)
      create(:enrollment, provider: dana, client: client, plan: "premium")
      create(:enrollment, provider: sam, client: client, plan: "basic")
      create(:enrollment, provider: create(:provider), client: create(:client))

      expect(client.providers).to contain_exactly(dana, sam)
    end

    it "is empty for a client with no providers" do
      expect(create(:client).providers).to be_empty
    end
  end

  describe "#journal_entries.recent_first" do
    it "returns newest entries first" do
      client = create(:client)
      oldest = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 1, 9))
      newest = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 3, 9))
      middle = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 2, 9))

      expect(client.journal_entries.recent_first.to_a).to eq([newest, middle, oldest])
    end

    it "breaks ties on equal written_at by newest id first" do
      client = create(:client)
      same_time = Time.zone.local(2026, 1, 5, 8)
      first = create(:journal_entry, client: client, written_at: same_time)
      second = create(:journal_entry, client: client, written_at: same_time)

      expect(client.journal_entries.recent_first.to_a).to eq([second, first])
    end

    it "excludes entries belonging to other clients" do
      client = create(:client)
      other = create(:client)
      mine = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 1))
      create(:journal_entry, client: other, written_at: Time.zone.local(2026, 1, 2))

      expect(client.journal_entries.recent_first.to_a).to eq([mine])
    end
  end
end
