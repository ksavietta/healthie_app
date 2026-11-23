require "rails_helper"

RSpec.describe Enrollment, type: :model do
  describe "associations" do
    it "requires a provider" do
      enrollment = build(:enrollment, provider: nil)

      expect(enrollment).not_to be_valid
      expect(enrollment.errors.include?(:provider)).to be(true)
    end

    it "requires a client" do
      enrollment = build(:enrollment, client: nil)

      expect(enrollment).not_to be_valid
      expect(enrollment.errors.include?(:client)).to be(true)
    end
  end

  describe "plan" do
    it "accepts basic" do
      expect(build(:enrollment, plan: "basic")).to be_valid
    end

    it "accepts premium" do
      expect(build(:enrollment, plan: "premium")).to be_valid
    end

    it "exposes the plan as a readable name" do
      enrollment = create(:enrollment, plan: "premium")

      expect(enrollment.reload.plan).to eq("premium")
      expect(enrollment).to be_premium
    end

    it "rejects a plan that is not basic or premium" do
      enrollment = build(:enrollment, plan: "gold")

      expect(enrollment).not_to be_valid
      expect(enrollment.errors.include?(:plan)).to be(true)
    end

    it "requires a plan" do
      enrollment = build(:enrollment, plan: nil)

      expect(enrollment).not_to be_valid
      expect(enrollment.errors.added?(:plan, :blank)).to be(true)
    end

    it "is rejected by the database check constraint when validations are bypassed" do
      provider = create(:provider)
      client = create(:client)

      expect {
        ActiveRecord::Base.transaction(requires_new: true) do
          Enrollment.insert_all!([{ provider_id: provider.id, client_id: client.id, plan: "gold" }])
        end
      }.to raise_error(ActiveRecord::CheckViolation)
    end
  end

  describe "one enrollment per provider and client pair" do
    it "rejects a second enrollment for the same provider and client" do
      existing = create(:enrollment)
      duplicate = build(:enrollment, provider: existing.provider, client: existing.client, plan: "premium")

      expect(duplicate).not_to be_valid
      expect(duplicate.errors.of_kind?(:client_id, :taken)).to be(true)
    end

    it "rejects a duplicate pair in the database when validations are bypassed" do
      existing = create(:enrollment)

      expect {
        ActiveRecord::Base.transaction(requires_new: true) do
          Enrollment.insert_all!([{
            provider_id: existing.provider_id, client_id: existing.client_id, plan: "premium"
          }])
        end
      }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "allows the same client with a different provider" do
      client = create(:client)
      create(:enrollment, client: client)

      expect(build(:enrollment, client: client)).to be_valid
    end

    it "allows the same provider with a different client" do
      provider = create(:provider)
      create(:enrollment, provider: provider)

      expect(build(:enrollment, provider: provider)).to be_valid
    end
  end

  describe "a client with several providers" do
    it "can hold different plans with each provider" do
      client = create(:client)
      dana = create(:provider)
      sam = create(:provider)

      create(:enrollment, provider: dana, client: client, plan: "premium")
      create(:enrollment, provider: sam, client: client, plan: "basic")

      plans = Enrollment.where(client: client).includes(:provider).to_h { |e| [e.provider_id, e.plan] }
      expect(plans).to eq(dana.id => "premium", sam.id => "basic")
    end
  end
end
