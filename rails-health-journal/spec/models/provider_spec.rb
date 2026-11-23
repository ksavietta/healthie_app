require "rails_helper"

RSpec.describe Provider, type: :model do
  describe "associations" do
    it "destroys its enrollments but keeps its clients when destroyed" do
      provider = create(:provider)
      client = create(:client)
      enrollment = create(:enrollment, provider: provider, client: client)

      provider.destroy!

      expect(Enrollment.exists?(enrollment.id)).to be(false)
      expect(Client.exists?(client.id)).to be(true)
    end
  end

  describe "validations" do
    it "is valid with a name and email" do
      expect(build(:provider)).to be_valid
    end

    it "requires a name" do
      provider = build(:provider, name: "")

      expect(provider).not_to be_valid
      expect(provider.errors.added?(:name, :blank)).to be(true)
    end

    it "requires an email" do
      provider = build(:provider, email: "")

      expect(provider).not_to be_valid
      expect(provider.errors.added?(:email, :blank)).to be(true)
    end

    it "rejects malformed email addresses" do
      ["plainaddress", "user@", "@example.com", "two words@example.com"].each do |bad|
        provider = build(:provider, email: bad)

        expect(provider).not_to be_valid, "expected #{bad.inspect} to be invalid"
        expect(provider.errors.of_kind?(:email, :invalid)).to be(true)
      end
    end

    it "strips whitespace and downcases the email before validation" do
      provider = build(:provider, email: "  Dana.Dietitian@Example.COM  ")

      expect(provider.email).to eq("dana.dietitian@example.com")
      expect(provider).to be_valid
    end

    it "rejects a duplicate email regardless of case" do
      create(:provider, email: "dana@example.com")
      duplicate = build(:provider, email: "DANA@example.com")

      expect(duplicate).not_to be_valid
      expect(duplicate.errors.of_kind?(:email, :taken)).to be(true)
    end
  end

  describe "database constraints" do
    it "rejects an exact duplicate email with the unique index, bypassing validations" do
      create(:provider, email: "dana@example.com")

      expect {
        ActiveRecord::Base.transaction(requires_new: true) do
          Provider.insert_all!([{ name: "Dup", email: "dana@example.com" }])
        end
      }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    # insert_all and update_column skip validations but still run `normalizes`,
    # so a case variant lands on the same normalized value and hits the index.
    it "rejects a case-variant duplicate email via insert_all, bypassing validations" do
      create(:provider, email: "dana@example.com")

      expect {
        ActiveRecord::Base.transaction(requires_new: true) do
          Provider.insert_all!([{ name: "Dup", email: "DANA@example.com" }])
        end
      }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "rejects a case-variant duplicate email via update_column, bypassing validations" do
      create(:provider, email: "dana@example.com")
      other = create(:provider, email: "sam@example.com")

      expect {
        ActiveRecord::Base.transaction(requires_new: true) do
          other.update_column(:email, "DANA@example.com")
        end
      }.to raise_error(ActiveRecord::RecordNotUnique)
    end
  end

  describe "#clients" do
    it "returns only the clients enrolled with this provider" do
      provider = create(:provider)
      other_provider = create(:provider)
      mine_one = create(:client)
      mine_two = create(:client)
      theirs = create(:client)

      create(:enrollment, provider: provider, client: mine_one)
      create(:enrollment, provider: provider, client: mine_two, plan: "premium")
      create(:enrollment, provider: other_provider, client: theirs)

      expect(provider.clients).to contain_exactly(mine_one, mine_two)
    end

    it "includes a client who also has other providers" do
      provider = create(:provider)
      shared_client = create(:client)
      create(:enrollment, provider: provider, client: shared_client)
      create(:enrollment, provider: create(:provider), client: shared_client)

      expect(provider.clients).to contain_exactly(shared_client)
    end

    it "is empty for a provider with no clients" do
      expect(create(:provider).clients).to be_empty
    end
  end
end
