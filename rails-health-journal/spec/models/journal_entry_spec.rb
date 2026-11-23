require "rails_helper"

RSpec.describe JournalEntry, type: :model do
  describe "associations" do
    it "belongs to a client" do
      entry = build(:journal_entry, client: nil)

      expect(entry).not_to be_valid
      expect(entry.errors.include?(:client)).to be(true)
    end
  end

  describe "validations" do
    it "is valid with a body and client" do
      expect(build(:journal_entry)).to be_valid
    end

    it "requires a body" do
      entry = build(:journal_entry, body: nil)

      expect(entry).not_to be_valid
      expect(entry.errors.added?(:body, :blank)).to be(true)
    end

    it "rejects a blank or whitespace-only body" do
      ["", "   \n"].each do |blank|
        entry = build(:journal_entry, body: blank)

        expect(entry).not_to be_valid, "expected #{blank.inspect} to be invalid"
        expect(entry.errors.added?(:body, :blank)).to be(true)
      end
    end

    it "keeps freeform multi-line text" do
      body = "Breakfast: oats.\n\nFelt good -- 8/10 energy!"
      entry = create(:journal_entry, body: body)

      expect(entry.reload.body).to eq(body)
    end
  end

  describe "written_at" do
    it "defaults to the current time when omitted" do
      travel_to(Time.zone.local(2026, 3, 1, 10, 0, 0)) do
        entry = create(:journal_entry)

        expect(entry.written_at).to eq(Time.zone.local(2026, 3, 1, 10, 0, 0))
        expect(entry.reload.written_at).to eq(Time.zone.local(2026, 3, 1, 10, 0, 0))
      end
    end

    it "keeps an explicit value instead of the default" do
      backdated = Time.zone.local(2026, 1, 10, 12, 0, 0)

      travel_to(Time.zone.local(2026, 3, 1, 10, 0, 0)) do
        entry = create(:journal_entry, written_at: backdated)

        expect(entry.reload.written_at).to eq(backdated)
      end
    end

    it "requires a value when explicitly set to nil" do
      entry = build(:journal_entry, written_at: nil)

      expect(entry).not_to be_valid
      expect(entry.errors.added?(:written_at, :blank)).to be(true)
    end
  end

  describe ".recent_first" do
    it "orders entries newest first" do
      client = create(:client)
      older = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 1))
      newer = create(:journal_entry, client: client, written_at: Time.zone.local(2026, 1, 2))

      expect(described_class.recent_first.where(client: client).to_a).to eq([newer, older])
    end

    it "uses id as a descending tiebreaker for equal written_at" do
      client = create(:client)
      same_time = Time.zone.local(2026, 1, 1, 12)
      first = create(:journal_entry, client: client, written_at: same_time)
      second = create(:journal_entry, client: client, written_at: same_time)

      expect(described_class.recent_first.where(client: client).to_a).to eq([second, first])
    end
  end

  describe ".for_provider" do
    let(:provider) { create(:provider) }
    let(:other_provider) { create(:provider) }

    it "returns entries from all of the provider's clients, newest first" do
      client_a = create(:client)
      client_b = create(:client)
      create(:enrollment, provider: provider, client: client_a)
      create(:enrollment, provider: provider, client: client_b)

      a_old = create(:journal_entry, client: client_a, written_at: Time.zone.local(2026, 1, 1))
      b_mid = create(:journal_entry, client: client_b, written_at: Time.zone.local(2026, 1, 2))
      a_new = create(:journal_entry, client: client_a, written_at: Time.zone.local(2026, 1, 4))
      b_new = create(:journal_entry, client: client_b, written_at: Time.zone.local(2026, 1, 3))

      expect(described_class.for_provider(provider).to_a).to eq([a_new, b_new, b_mid, a_old])
    end

    it "excludes entries from clients who are not enrolled with the provider" do
      mine = create(:client)
      theirs = create(:client)
      create(:enrollment, provider: provider, client: mine)
      create(:enrollment, provider: other_provider, client: theirs)

      my_entry = create(:journal_entry, client: mine)
      create(:journal_entry, client: theirs)

      expect(described_class.for_provider(provider).to_a).to eq([my_entry])
    end

    it "returns each entry once when a client has several providers" do
      shared = create(:client)
      create(:enrollment, provider: provider, client: shared)
      create(:enrollment, provider: other_provider, client: shared)
      entries = create_list(:journal_entry, 3, client: shared)

      result = described_class.for_provider(provider).to_a

      expect(result.size).to eq(3)
      expect(result.map(&:id)).to match_array(entries.map(&:id))
    end

    it "is empty for a provider with no clients" do
      expect(described_class.for_provider(create(:provider))).to be_empty
    end

    it "is also available as Provider#journal_entries" do
      client = create(:client)
      create(:enrollment, provider: provider, client: client)
      create_list(:journal_entry, 2, client: client)

      expect(provider.journal_entries.to_a).to eq(described_class.for_provider(provider).to_a)
      expect(provider.journal_entries.size).to eq(2)
    end
  end
end
